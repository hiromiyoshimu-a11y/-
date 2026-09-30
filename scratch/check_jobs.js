import axios from 'axios';

async function checkJobs() {
  try {
    const runsRes = await axios.get('https://api.github.com/repos/hiromiyoshimu-a11y/-/actions/runs');
    const latestRun = runsRes.data.workflow_runs[0];
    console.log('Run id:', latestRun.id, 'status:', latestRun.status);

    const jobsRes = await axios.get(`https://api.github.com/repos/hiromiyoshimu-a11y/-/actions/runs/${latestRun.id}/jobs`);
    jobsRes.data.jobs.forEach(job => {
      console.log(`Job: ${job.name}, status=${job.status}, conclusion=${job.conclusion}`);
      job.steps.forEach(step => {
        console.log(`   - Step "${step.name}": status=${step.status}, conclusion=${step.conclusion}`);
      });
    });
  } catch (err) {
    console.error('Error fetching jobs:', err.message);
  }
}

checkJobs();
