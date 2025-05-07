import axios from "axios";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from 'react-router-dom';
import { Container, Row, Col, ListGroup, Tab, Card, Button, Image } from 'react-bootstrap';

const Jobs = () => {
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [activeKey, setActiveKey] = useState("");
  const colorMap = ['warning', 'danger', 'success', 'primary'];
  
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const queryParameters = new URLSearchParams(location.search);
        const status = queryParameters.get("status");
        console.log("Current status:", status);
       
        let res;
        if(status) {
          res = await axios.get(`http://localhost/jobs?status=${status}`);
        } else {
          res = await axios.get("http://localhost/jobs");
        }
       
        setJobs(res.data);
        if (res.data.length > 0) {
          setActiveKey(`list-${res.data[0].id}`);
        }
      } catch (error) {
        console.log(error);
      }
    };
    
    fetchJobs();
  }, [location.search]);

  const findActiveTabIndex = useCallback(() => {
    if (!activeKey) return 0;
    const activeId = activeKey.replace('list-', '');
    return jobs.findIndex(job => job.id.toString() === activeId);
  }, [jobs, activeKey]);

  const moveToNextTab = useCallback(() => {
    const activeIndex = findActiveTabIndex();
    const nextIndex = (activeIndex + 1) % jobs.length;
    setActiveKey(`list-${jobs[nextIndex].id}`);
    scrollQualifications(jobs[nextIndex].id);
  }, [jobs, findActiveTabIndex]);
      
  const moveToPreviousTab = useCallback(() => {
    const activeIndex = findActiveTabIndex();
    const prevIndex = activeIndex === 0 ? jobs.length - 1 : activeIndex - 1;
    setActiveKey(`list-${jobs[prevIndex].id}`);
    scrollQualifications(jobs[prevIndex].id);
  }, [jobs, findActiveTabIndex]);

  const updateStatus = useCallback((jobId, newStatus, appliedDate) => {
    setJobs(prevJobs => {
      const updatedJobs = prevJobs.map(job =>
        job.id === Number(jobId) ? { ...job, status: newStatus } : job
      );
      
      return updatedJobs;
    });
    axios.put(`http://localhost/jobs/${jobId}`, { status: newStatus, date_applied: appliedDate });
  }, []);

  const handleKeyPress = useCallback((e) => {
    if (jobs.length === 0) {
      return;
    }
    
    if (e.key === 's' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveToNextTab();
    } else if (e.key === 'w' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveToPreviousTab();
    } else if (e.key === 'a' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const activeId = activeKey.replace('list-', '');
      updateStatus(activeId, 1, null);
      moveToNextTab();
    } else if (e.key === 'd' || e.key === 'ArrowRight') {
      e.preventDefault();
      const activeId = activeKey.replace('list-', '');
      updateStatus(activeId, 2, null);
      moveToNextTab();
    } else if (e.key === 'f') {
      e.preventDefault();
      const activeId = activeKey.replace('list-', '');
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      updateStatus(activeId, 3, `${year}-${month}-${day}`);
      
      const activeIndex = findActiveTabIndex();
      const job = jobs[activeIndex];
      window.open(job.url, "_blank", "noreferrer");
      moveToNextTab();
    }
  }, [jobs, activeKey, moveToNextTab, moveToPreviousTab, updateStatus, findActiveTabIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const addDefaultImg = ev => {
    ev.target.src = "default.svg";
  };

  const scrollQualifications = (jobId) => {
    setTimeout(() => {
      const job_element = document.getElementById(`qualifications-${jobId}`);
      if (job_element) {
        job_element.scrollIntoView({
          behavior: "smooth", 
          block: "start"
        });
      }
      
      const list_element = document.getElementById(`list-${jobId}`);
      if (list_element) {
        list_element.scrollIntoView({
          behavior: "smooth", 
          block: "center"
        });
      }
    }, 100);
  };

  const handleSelect = (key) => {
    setActiveKey(key);
    const jobId = key.replace('list-', '');
    scrollQualifications(jobId);
  };

  return (
    <Container className="my-4">
      <Row className="gx-2">
        <Col md={4}>
          <ListGroup id="list-tab" className="scroll">
            {jobs.map((job, index) => (
              <ListGroup.Item
                key={job.id}
                action
                active={activeKey === `list-${job.id}`}
                id={`list-${job.id}`}
                onClick={() => handleSelect(`list-${job.id}`)}
                className="py-2"
              >
                <Row className="align-items-center gx-2">
                  <Col xs="auto">
                    <Image
                      src={`logos/${job.id}.jpg`}
                      width="45"
                      height="45"
                      onError={addDefaultImg}
                    />
                  </Col>
                  <Col>
                    <span className={`text-${colorMap[job.status]}`}>⬤</span> <strong>{job.title}</strong>
                    <br />
                    <span>{job.company} - {job.location}</span>
                  </Col>
                </Row>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Col>
        <Col md={8}>
          <Tab.Content id="nav-tabContent">
            {jobs.map((job, index) => (
              <Tab.Pane
                key={job.id}
                active={activeKey === `list-${job.id}`}
                id={`pane-${job.id}`}
                transition={false}
              >
                <Card>
                  <Card.Header className="p-3">
                    <Row className="align-items-center gx-3">
                      <Col xs="auto">
                        <Image
                          src={`logos/${job.id}.jpg`}
                          width="45"
                          height="45"
                          onError={addDefaultImg}
                        />
                      </Col>
                      <Col>
                        <strong>
                          <a href={`https://www.linkedin.com/jobs/view/${job.id}`}>{job.title}</a>
                        </strong>
                        <Card.Text>
                          {job.company} - {job.location} {/* - <strong>{job.meta}</strong> */}
                        </Card.Text>
                      </Col>
                      <Col xs="auto">
                        <Button variant="info" className="m-1" onClick={() => scrollQualifications(job.id)}>
                          🔍
                        </Button>
                        {job.status !== 1 && (
                          <Button variant="danger" className="m-1" onClick={() => handleKeyPress({ key: 'a', preventDefault: () => {} })}>
                            🛇
                          </Button>
                        )}
                        {job.status < 2 && (
                          <Button variant="success" className="m-1" onClick={() => handleKeyPress({ key: 'd', preventDefault: () => {} })}>
                            ✓
                          </Button>
                        )}
                        {job.status === 2 && (
                          <Button variant="info" onClick={() => handleKeyPress({ key: 'f', preventDefault: () => {} })}>
                            Apply
                          </Button>
                        )}
                      </Col>
                    </Row>
                  </Card.Header>
                  <Card.Body 
                    className="scroll-2" 
                    dangerouslySetInnerHTML={{ __html: job.description }}
                  />
                </Card>
              </Tab.Pane>
            ))}
          </Tab.Content>
        </Col>
      </Row>
    </Container>
  );
};

export default Jobs;