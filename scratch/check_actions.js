import axios from 'axios';

async function checkActions() {
  try {
    const res = await axios.get('https://api.github.com/repos/hiromiyoshimu-a11y/-/actions/runs');
    console.log('Total runs:', res.data.total_count);
    res.data.workflow_runs.slice(0, 5).forEach(run => {
      console.log(`Run #${run.run_number}: status=${run.status}, conclusion=${run.conclusion}, commit=${run.head_commit.message}, createdAt=${run.created_at}`);
    });
  } catch (err) {
    console.error('Error fetching actions runs:', err.message);
  }
}

checkActions();
