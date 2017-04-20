const app = require('express')();
const cors = require('cors');
const srv = require('http').createServer(app);
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const queryString = require('query-string');
const mcache = require('memory-cache');
const { RateLimiter } = require('limiter');
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

// Meetup API allows 30 requests every 10 seconds.
const limiter = new RateLimiter(20, 10000);

function MeetupError(request) {
  this.status = request.status;
  this.statusText = request.statusText;
  this.stack = new Error().stack;
}
MeetupError.prototype = Object.create(Error.prototype);
MeetupError.prototype.constructor = MeetupError;

const MANCREACT_URL_NAME = 'Manchester-React-User-Group';
const MEETUP_API_ROOT = 'https://api.meetup.com/';

const meetupAPI = async (uri, req, args) => {
  const noArgs = args == null;
  let url =
    MEETUP_API_ROOT + uri + (noArgs ? '' : `?${queryString.stringify(args)}`);
  url += noArgs ? '?' : '&';
  if (
    req.get('X-Access-Token') != null && req.get('X-Access-Token') !== 'null'
  ) {
    url += `access_token=${req.get('X-Access-Token')}`;
  } else {
    url += `key=${process.env.MEETUP_KEY}`;
  }
  const request = await fetch(url, {
    method: req.method,
  });
  if (!request.ok) {
    throw new MeetupError(request);
    return;
  }
  const data = await request.json();
  return data;
};

app.options('*', cors()); // include before other routes
app.use(cors());

app.use((req, res, next) => {
  limiter.removeTokens(1, () => {
    next();
  });
});

const cache = (duration = 60) => {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url;
    let cachedBody = mcache.get(key);
    if (cachedBody) {
      res.send(cachedBody);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = body => {
        mcache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
      next();
    }
  };
};

app.get('/group', cache(), async (req, res) => {
  const response = await meetupAPI(MANCREACT_URL_NAME, req);
  res.send(response);
});

app.get('/events', cache(), async (req, res, next) => {
  try {
    const response = await meetupAPI(MANCREACT_URL_NAME + '/events', req, {
      status: 'past,upcoming,draft',
    });
    res.send(response);
  } catch (err) {
    res.status(err.status).send(err.statusText);
  }
});

app.get('/events/:id', cache(), async (req, res, next) => {
  let response;
  try {
    response = await meetupAPI(
      MANCREACT_URL_NAME + `/events/${req.params.id}`,
      req,
      {
        status: 'past,upcoming,draft',
      }
    );
    res.send(response);
  } catch (err) {
    res.status(err.status).send(err.statusText);
  }
});

app.get('/events/:id/rsvps', async (req, res, next) => {
  try {
    res.send(
      await meetupAPI(
        MANCREACT_URL_NAME + `/events/${req.params.id}/rsvps`,
        req,
        {
          response: 'yes',
        }
      )
    );
  } catch (err) {
    res.status(err.status).send(err.statusText);
  }
});

app.post('/events/:id/rsvps', async (req, res, next) => {
  try {
    const response = await meetupAPI(
      MANCREACT_URL_NAME + `/events/${req.params.id}/rsvps`,
      req,
      {
        response: req.query.response,
      }
    );
    res.send(response);
  } catch (err) {
    res.status(err.status).send(err.statusText);
  }
});

app.get('/events/:id/comments', async (req, res, next) => {
  res.send(
    await meetupAPI(
      MANCREACT_URL_NAME + `/events/${req.params.id}/comments`,
      req
    )
  );
});

app.post('/events/:id/comments', async (req, res, next) => {
  let response;
  try {
    response = await meetupAPI(
      MANCREACT_URL_NAME + `/events/${req.params.id}/comments`,
      req,
      {
        comment: req.query.comment,
      }
    );
    res.send(response);
  } catch (err) {
    res.status(err.status).send(err.statusText);
  }
});

app.get('/members/self', async (req, res, next) => {
  res.send(await meetupAPI(`members/self`, req));
});

const port = process.env.PORT || 4000;

srv.listen(port, function() {
  console.log(`Listening on ${port}`);
});
