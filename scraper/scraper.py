import tomllib
import random
import time
from datetime import datetime
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import mysql.connector
import re
import shutil
import subprocess


# Define project root directory
root_dir = Path(__file__).resolve().parent.parent

# Global variable for VPN process
vpn_process = None

# Connect to MySQL database
def connect_db(config):
    try:
        connection = mysql.connector.connect(
            host=config['mysql']['host'],
            user=config['mysql']['user'],
            password=config['mysql']['password'],
            database=config['mysql']['database'],
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci'
        )
        return connection
    except Exception as e:
        print(f"Fail to connect to database: {e}")
        exit()

# Return current local time string
def get_time():
    local_time = time.localtime(time.time())
    return f"{local_time.tm_hour}:{local_time.tm_min}:{local_time.tm_sec}: "

# Establish VPN connection using OpenVPN
def establish_vpn_connection(config, original_ip):
    global vpn_process
    terminate_vpn_connection()

    vpn_server_number = random.randint(1, config['vpn']['max_server'])
    openvpn_path = config['vpn']['path']
    ovpn_file = root_dir / "scraper" / "vpn" / f"us-free-{vpn_server_number}.protonvpn.udp.ovpn"
    auth_file_path = root_dir / "scraper" / "vpn" / "auth.txt"

    cmd = [
        openvpn_path,
        "--config", ovpn_file,
        "--auth-user-pass", auth_file_path
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    print(get_time() + f"Establishing VPN connection to server {vpn_server_number} ...")

    connected = False
    start_time = time.time()
    max_sec = 120

    # Wait until VPN is connected or timeout
    while (time.time() - start_time) < max_sec and not connected:
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            print(get_time() + f"Error: {stderr}")
            print(f"Output: {stdout}")
            exit()

        output_line = process.stdout.readline().strip()
        if output_line:
            print(output_line)
            if "Initialization Sequence Completed" in output_line:
                connected = True
                print(get_time() + f"VPN server {vpn_server_number} connection established successfully.")
                if original_ip == check_ip_address():
                    print(get_time() + "IP address did not change after VPN connection.")
                    exit()
                break
        time.sleep(0.1)

    if not connected:
        print(get_time() + "Timed out waiting for VPN connection.")
        process.terminate()
        exit()
    vpn_process = process

# Get current external IP address
def check_ip_address():
    try:
        response = requests.get('https://api.ipify.org?format=json', timeout=5)
        ip_data = response.json()
        return ip_data['ip']
    except Exception as e:
        return f"Failed to get IP address: {str(e)}"

# Terminate active VPN connection
def terminate_vpn_connection():
    global vpn_process
    if vpn_process:
        vpn_process.terminate()
        start_time = time.time()
        max_sec = 15
        while (time.time() - start_time) < max_sec:
            if vpn_process.poll() is None:
                print(get_time() + "VPN connection terminated")
                return
            time.sleep(0.1)
        print(get_time() + "Fail to terminate VPN connection")
        vpn_process.kill()
        exit()

# Fetch HTML page content with retries
def fetch_html(config, url):
    headers = {"User-Agent": config['requests']['user_agent']}
    for i in range(3):
        time.sleep(random.uniform(config['requests']['min_delay'], config['requests']['max_delay']))
        try:
            response = requests.get(url, headers=headers, timeout=5)
            return BeautifulSoup(response.content, 'html.parser', from_encoding='utf-8')
        except requests.exceptions.Timeout:
            print(f"Fail to fetch URL: {url}. Timeout")
        except Exception as e:
            print(f"Fail to fetch URL: {url}. {e}")
            return None

# Insert job data into database
def import_job(config, jobs, db):
    total_jobs = len(jobs)
    cursor = db.cursor()
    insert_statement = "INSERT INTO jobs (id, title, company, location, date_created, description, meta, url, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
    values = [(job['id'], job['title'], job['company'], job['location'], job['date_created'], job['description'], job['meta'], job['url'], job['status']) for job in jobs]
    try:
        cursor.executemany(insert_statement, values)
        db.commit()
        print(get_time() + f"Imported {total_jobs} jobs successfully")
    except Exception as e:
        print("Fail to import jobs: " + e)

# Truncate job descriptions that exceed size limit
def truncate_desc(desc):
    indicator = "\n[Content has been truncated]"
    max_bytes = 10000 - len(indicator.encode("utf-8"))
    current_bytes = 0
    new_desc = []

    for child in desc.children:
        child_str = child if isinstance(child, str) else str(child)
        encoded_bytes = child_str.encode("utf-8")
        if current_bytes + len(encoded_bytes) > max_bytes:
            break
        new_desc.append(child_str)
        current_bytes += len(encoded_bytes)

    new_desc.append(indicator)
    return BeautifulSoup("".join(new_desc), "html.parser")

# Process job description to find experience/qualification
def process_description(job_posting):
    parsed_description = job_posting['description']
    experience_pattern = re.compile(r'(\d+)\s*\+?\s*years?', re.IGNORECASE)

    for text_node in parsed_description.find_all(string=True):
        if text_node.parent.name in ['script', 'style', 'span']:
            continue

        matches = list(experience_pattern.finditer(str(text_node)))
        if not matches:
            continue

        modified_fragment = str(text_node)
        for match in reversed(matches):
            try:
                if int(match.group(1)) > 2 and int(match.group(1)) < 20:
                    job_posting['status'] = 0
            except Exception:
                pass

            start, end = match.span()
            highlighted_years = f'<span class="highlight">{match.group(0)}</span>'
            modified_fragment = modified_fragment[:start] + highlighted_years + modified_fragment[end:]

        text_node.replace_with(BeautifulSoup(modified_fragment, 'html.parser'))

    qualification_section = None
    strong_elements = parsed_description.find_all('strong')
    qualification_keywords = {'qualification', 'qualifications', 'requirement', 'requirements', 'skil', 'skils', 'require', 'bring', 'you'}

    for element in strong_elements:
        section_text = element.get_text(strip=True).lower()
        if any(keyword in section_text for keyword in qualification_keywords):
            qualification_section = element
            break

    if qualification_section is None:
        qualification_section = parsed_description.find(class_='highlight')

    if qualification_section:
        if (qualification_section.parent.parent.previous_sibling is not None and 
            qualification_section.parent.parent.previous_sibling.name == 'strong'):
            qualification_section = qualification_section.parent.parent.previous_sibling
        job_id = str(job_posting['id'])
        qualification_section['id'] = f'qualifications-{job_id}'
        qualification_section['class'] = 'qualifications'

    job_posting['description'] = parsed_description
    return job_posting

# Fetch job details and company logos
def fetch_job(config, jobs, db):
    print("FILTER JOBS:")
    cursor = db.cursor()
    try:
        cursor.execute("SELECT id FROM jobs")
        existing_jobs_ids = set(row[0] for row in cursor.fetchall())
        new_jobs = [job for job in jobs if job['id'] not in existing_jobs_ids]
        total = len(new_jobs)
        print(f" - Number of unfilter jobs: {total}")
        job_index = 0

        for job in new_jobs:
            url = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + str(job['id'])
            try:
                response = fetch_html(config, url)
                job['description'] = response.find(class_='description__text description__text--rich').find('div')
                if config['processing']['enable']:
                    job = process_description(job)
                if len(job['description'].decode_contents().encode("utf-8")) > 10000:
                    job['description'] = truncate_desc(job['description'])
                job['description'] = job['description'].decode_contents().lstrip().replace('\n', '')

                applicant_num = ''.join(filter(str.isdigit, response.find(class_="num-applicants__caption").decode_contents()))
                time_text = response.find(class_="posted-time-ago__text").decode_contents().lstrip().rstrip()[:-4]
                job['meta'] = f"{applicant_num} applicants - {time_text}"

                job['url'] = response.find(id='applyUrl')
                job['url'] = job['url'].string[1:-1] if job['url'] else 'https://www.linkedin.com/jobs/view/' + str(job['id'])

                url = response.find(class_="artdeco-entity-image").get('data-delayed-url')
                if url:
                    image_response = requests.get(url, stream=True)
                    name = Path(root_dir) / "client" / "public" / "logos" / f"{job['id']}.jpg"
                    with open(name, 'wb') as f:
                        shutil.copyfileobj(image_response.raw, f)
                job_index += 1
                print(get_time() + f"[{job_index}/{total}] Processed job {job['id']}")
            except Exception as e:
                print("Url: " + url)
                print(f"Error: {e}")
        return new_jobs
    finally:
        cursor.close()

# Search and retrieve job listings
def search_job(config):
    db = connect_db(config)
    max_pages = config['search']['max_pages']
    original_ip = check_ip_address()
    global vpn_process

    for keyword in config['search']['keywords']:
        for location in config['search']['locations']:
            jobs = []
            print(f"SEARCH JOB SET:")
            print(f" - Keywords: {keyword}")
            print(f" - Location: {location}")
            print(f" - Work Type: {config['search']['f_WT']}")
            print(f" - Timespan: {config['search']['timespan']}")
            for page_index in range(max_pages):
                url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={keyword}&location={location[0]}&geoId={location[1]}&f_E=2&f_TPR={config['search']['timespan']}&f_WT={config['search']['f_WT']}&start={page_index*25}"
                if config['vpn']['enable'] and page_index % config['vpn']['max_pages'] == 0:
                    establish_vpn_connection(config, original_ip)
                try:
                    response = fetch_html(config, url)
                    list_items = response.find_all('li')
                    for item in list_items:
                        id = item.find('div', class_='base-card').get('data-entity-urn').split(':')[-1]
                        title = item.find(class_='base-search-card__title').get_text(strip=True)
                        company = item.find(class_='base-search-card__subtitle').get_text(strip=True)
                        location = item.find(class_='job-search-card__location').get_text(strip=True)
                        date_created = item.find('time').get('datetime')
                        job = {
                            'id': int(id),
                            'title': title,
                            'company': company,
                            'location': location,
                            'date_created': datetime.strptime(date_created, "%Y-%m-%d"),
                            'description': '',
                            'meta': '',
                            'url': '',
                            'status': 0
                        }
                        jobs.append(job)

                    print(get_time() + f"[{page_index + 1}/{max_pages}] Processed page {page_index + 1}")
                    if len(list_items) == 0:
                        print(get_time() + "\nReached end of results")
                        break
                    jobs = fetch_job(config, jobs, db)
                    import_job(config, jobs, db)
                except Exception as e:
                    terminate_vpn_connection()
                    print(f"Url: {url}")
                    print(f"Error: {e}")
            terminate_vpn_connection()
    db.close()

def main(config):
    print("🔍 LINKEDIN JOB SCRAPER")
    search_job(config)

if __name__ == "__main__":
    config_path = root_dir / "scraper" / "config.TOML"
    with open(config_path, "rb") as f:
        config = tomllib.load(f)
    main(config)
    f.close
