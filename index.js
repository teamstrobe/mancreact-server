const app = require('express')();
const cors = require('cors');
const srv = require('http').createServer(app);
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const queryString = require('query-string');
const {RateLimiter} = require('limiter');
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

// Meetup API allows 30 requests every 10 seconds.
const limiter = new RateLimiter(15, 10000);

function MeetupError(request) {
  this.status = request.status;
  this.statusText = request.statusText;
  this.stack = (new Error()).stack;
}
MeetupError.prototype = Object.create(Error.prototype);
MeetupError.prototype.constructor = MeetupError;

const MANCREACT_EVENT_ID = process.env.MEETUP_GROUP_ID;
const MANCREACT_URL_NAME = process.env.MEETUP_URL_NAME;
const MEETUP_API_ROOT = 'https://api.meetup.com/';

const meetupAPI = async (uri, args) => {
  const noArgs = args == null;
  let url = MEETUP_API_ROOT + uri + (noArgs ? '' : `?${queryString.stringify(args)}`)
  url += (noArgs ? '?' : '&');
  url += `key=${process.env.MEETUP_KEY}`;
  const request = await fetch(url);
  if (request.status !== 200) {
    throw new MeetupError(request);
    return;
  }
  const data = await request.json();
  return data;
};

app.options('*', cors()) // include before other routes
app.use(cors());

app.use((req, res, next) => {
  limiter.removeTokens(1, () => {
    next();
  });
})

app.get('/group', async (req, res, next) => {
  const response = await meetupAPI(MANCREACT_URL_NAME);
  res.send(response);
});

app.get('/events', async (req, res, next) => {
  try {
    const response = await meetupAPI(MANCREACT_URL_NAME + '/events', {
      status: 'past,upcoming,draft'
    });
    res.send(response);
  } catch (e) {
    res.status(e.status).send(e.statusText);
  }
});

app.get('/events/:id', async (req, res, next) => {
  res.send(await meetupAPI(MANCREACT_URL_NAME + `/events/${req.params.id}`, {
    status: 'past,upcoming,draft'
  }));
});

app.get('/events/:id/rsvps', async (req, res, next) => {
  res.send(await meetupAPI(MANCREACT_URL_NAME + `/events/${req.params.id}/rsvps`, {
    response: 'yes',
  }));
});

app.get('/events/:id/comments', async (req, res, next) => {
  res.send(await meetupAPI(MANCREACT_URL_NAME + `/events/${req.params.id}/comments`));
});

srv.listen(3000, function () {
  console.log('Listening on 3000');
});
