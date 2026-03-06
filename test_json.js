const payload = {
  "data": [
    {
      "id": "8a7c8881-0191-4cbb-b9ec-18eed1efb115",
      "start_time": "2026-03-03T23:18:35.764372+00:00",
      "feedbackStatus": "expired"
    },
    {
      "id": "7b244e4a-2c5b-43a3-94da-46da2a02f954",
      "start_time": "2026-03-03T23:23:02.509393+00:00",
      "feedbackStatus": "expired"
    },
    {
      "id": "0dcf737a-eaf5-473d-bf26-cd17313e096b",
      "start_time": "2026-03-04T18:36:42.403153+00:00",
      "feedbackStatus": "pending"
    }
  ]
};

const now = new Date("2026-03-05T00:43:39+01:00").getTime(); // User time

payload.data.forEach(a => {
  const startTime = new Date(a.start_time).getTime();
  const hoursSince = (now - startTime) / (1000 * 60 * 60);
  console.log(`ID: ${a.id}`);
  console.log(`Start Time: ${a.start_time}`);
  console.log(`Hours Since Start: ${hoursSince.toFixed(2)}`);
  console.log(`Status in DB: ${a.feedbackStatus}`);
  console.log('---');
});
