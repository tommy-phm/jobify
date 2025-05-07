import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const Job = () => {
    const [job, setJob] = useState({})
    const { id } = useParams(); 
    
    useEffect(() => {
        const fetchJob = async () => {
          try {
            const response = await axios.get(`http://localhost/jobs/${id}`)

            setJob(response.data);
          } catch (error) {
            console.error("Error fetching job:", error);
          }
        };
        
        fetchJob();
    }, [id]);

    return (
        <div>
            <h1>Jobs</h1>
            {job ? (
                <div>
                    {job.title} - {job.company} <br />
                    <div dangerouslySetInnerHTML={{ __html: job.description }} />
                </div>
            ) : (
                <div>Loading...</div>
            )}
        </div>
    );
};

export default Job;