import axios from 'axios';

async function testUnpaywall(doi) {
  const url = `https://api.unpaywall.org/v2/${doi}?email=hiromiyoshimu@gmail.com`;
  try {
    const res = await axios.get(url);
    console.log(`Unpaywall Result for DOI ${doi}:`);
    console.log(`is_oa:`, res.data.is_oa);
    console.log(`oa_status:`, res.data.oa_status);
    console.log(`best_oa_location:`, res.data.best_oa_location);
    console.log(`first_oa_location:`, res.data.first_oa_location);
    if (res.data.best_oa_location) {
      console.log(`URL_FOR_PDF:`, res.data.best_oa_location.url_for_pdf);
      console.log(`URL_FOR_LANDING_PAGE:`, res.data.best_oa_location.url_for_landing_page);
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testUnpaywall('10.1016/j.hrthm.2026.05.051');
