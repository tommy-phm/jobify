import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { Container, Row, Col, Card } from 'react-bootstrap';

Chart.register(...registerables);

const Home = () => {
  const [statistics, setStatistics] = useState({});

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const res = await axios.get("http://localhost/statistics");
        setStatistics(res.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchStatistics();
  }, []);
    
  const lineData = useMemo(() => {
    const last7Days = statistics?.appliedCount?.slice(0, 7).reverse() || [];
    return {
      labels: last7Days.map(item => item.date_applied.substr(5, 5)),
      datasets: [
        {
          label: 'Jobs',
          data: last7Days.map(item => item.job_applied),
          backgroundColor: 'rgba(78, 115, 223, 0.2)',
          borderColor: '#3399ff',
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: '#3399ff',
          pointRadius: 3,
          fill: true,
        },
      ],
    };
  }, [statistics]);

  const lineOptions = {
    responsive: true,
    aspectRatio: 1.7,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        ticks: {
          maxTicksLimit: 6,
        },
        grid: {
          color: "gray"
        },
        border: {
          display: false 
        },
        min: 0
      },
      x: {
        ticks: {
          maxTicksLimit: 10
        },
        grid: {
          display: false
        },
      },
    },
  };
    
  const pieData = useMemo(() => {
    return {
      labels: ['Unprocessed', 'Rejected', 'Accepted', 'Applied'],
      datasets: [
        {
          label: 'Job',
          data: [statistics?.unprocessed, statistics?.rejected, statistics?.accepted, statistics?.applied],
          backgroundColor: ['#ffc107', '#dc3545', '#198754', '#0d6efd'],
          borderWidth: 1,
          type: 'doughnut',
        },
      ],
    };
  }, [statistics]);
  
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
  };
    
  return (
    <main>
      <Container className="my-5">
        <h1 className="h3 mb-5">Dashboard</h1>
        <Row className="mb-4">
          <Col>
            <Card bg="warning" text="white" as={Link} to="/jobs?status=0" className="text-decoration-none">
              <Card.Body>
                <Card.Title as="h5">{ statistics?.unprocessed ? statistics.unprocessed : "0"}</Card.Title>
                <Card.Text>Unprocessed Jobs</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card bg="danger" text="white" as={Link} to="/jobs?status=1" className="text-decoration-none">
              <Card.Body>
                <Card.Title as="h5">{ statistics?.rejected ? statistics.rejected : "0"}</Card.Title>
                <Card.Text>Rejected Jobs</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card bg="success" text="white" as={Link} to="/jobs?status=2" className="text-decoration-none">
              <Card.Body>
                <Card.Title as="h5">{ statistics?.accepted ? statistics.accepted : "0"}</Card.Title>
                <Card.Text>Accepted Jobs</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card bg="primary" text="white" as={Link} to="/jobs?status=3" className="text-decoration-none">
              <Card.Body>
                <Card.Title as="h5">{ statistics?.applied ? statistics.applied : "0"}</Card.Title>
                <Card.Text>Applied Jobs</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card bg="secondary" text="white" as={Link} to="/jobs?" className="text-decoration-none">
              <Card.Body>
                <Card.Title as="h5">{ statistics?.total ? statistics.total : "0"}</Card.Title>
                <Card.Text>Total Jobs</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Row>
          <Col md={8} className="d-flex">
            <Card className="w-100">
              <Card.Header className="p-3">
                <h5 className="mb-0">Applied Jobs</h5>
              </Card.Header>
              <Card.Body className="m-3">
                <Line data={lineData} options={lineOptions} />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="d-flex">
            <Card className="w-100">
              <Card.Header className="p-3">
                <h5 className="mb-0">Job Status</h5>
              </Card.Header>
              <Card.Body className="m-3">
                <Pie data={pieData} options={pieOptions} />
                <div className="mt-3 px-3">
                  <Row>
                    <Col>
                      <span style={{ color: '#f9b115' }}>⬤</span> Unprocessed
                    </Col>
                    <Col className="text-end">
                      { statistics?.unprocessed ? (statistics.unprocessed / statistics.total * 100).toFixed(2) : "0" } %
                    </Col>
                  </Row>
                  <Row>
                    <Col>
                      <span style={{ color: '#e55353' }}>⬤</span> Rejected
                    </Col>
                    <Col className="text-end">
                      { statistics?.rejected ? (statistics.rejected / statistics.total * 100).toFixed(2) : "0"} %
                    </Col>
                  </Row>
                  <Row>
                    <Col>
                      <span style={{ color: '#1b9e3e' }}>⬤</span> Accepted
                    </Col>
                    <Col className="text-end">
                      { statistics?.accepted ? (statistics.accepted / statistics.total * 100).toFixed(2) : "0"} %
                    </Col>
                  </Row>
                  <Row>
                    <Col>
                      <span style={{ color: '#3399ff' }}>⬤</span> Applied
                    </Col>
                    <Col className="text-end">
                      { statistics?.applied ? (statistics.applied / statistics.total * 100).toFixed(2) : "0"} %
                    </Col>
                  </Row>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </main>
  );
};

export default Home;