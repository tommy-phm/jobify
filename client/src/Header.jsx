import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Nav, Navbar, NavDropdown  } from 'react-bootstrap';

function Header() {
  return (
    <header>
      <Navbar bg="white" expand="lg" className="border-bottom">
        <Container>
          <Navbar.Brand as={Link} to="/">
            <img
              src="icon.png"  
              width="27"
              height="27"
              className="d-inline-block align-bottom"
              alt="Jobify Logo"
            />
            <span className="mx-3">Jobify</span>
          </Navbar.Brand>
          <Nav className="ms-auto">
          <Nav.Link as={Link} to="/home" className="">Home</Nav.Link>
            <NavDropdown title="Jobs" id="resources-dropdown" className="" align="end">
                <NavDropdown.Item as={Link} to="/jobs?status=0">Unprocessed</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/jobs?status=1">Rejected</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/jobs?status=2">Accepted</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/jobs?status=3">Applied</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item as={Link} to="/jobs">All</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Container>
      </Navbar>
    </header>
  );
}

export default Header;