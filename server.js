'use strict';

//===========================App Dependiencies============================
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

//========================Load environment variables from .env file================================
const result = require('dotenv').config();

//========================Application Setup====================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// ===========================DATABASE CONFIG====================================
const client = new pg.Client(process.env.DATABASE_URL);

client.connect();
client.on('err', err => console.log(err));

//============================API Routes====================================
app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/movies', getMovies);
app.get('/yelp', getRestaurants);
app.get('/meetups', getMeetUps);
app.get('/trails', getTrails);

app.listen(PORT, () => console.log(`Listening on ${PORT}`));


//============================Error Handler==================================
function handleError(err, res) {
  console.error(err);
  if (res) res.satus(500).send('Sorry, something broke');
}

//============================Database Lookup====================================
function lookUp(options) {
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id=$1;`;
  const values =[options.location];

  client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0) {
        options.cacheHit(result);
      } else {
        options.cacheMiss();
      }
    });
    .catch(error => handleError(error));
}

//============================Database Clear Function==================================
function delByLocId(table, city) {
  const SQL = `DELETE from ${table} WHERE location_id=${city};`;
  return client.query(SQL);
}

// ===========================Location api=======================================
function Location(query, data) {
  this.tableName = 'locations';
  this.search_query = query;
  this.formatted_query = data.body.results[0].formatted_address;
  this.latitude = data.body.results[0].geometry.location.lat;
  this.longitude = data.body.results[0].geometry.location.lng;
  this.addedToDB = Date.now();
}

Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [handler.query];

  return client.query(SQL, values)
    .then(results => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      } else {
        handler.cacheMiss();
      }
    })
    .catch(console.error);
};
Location.prototype = {
  save: function() {
    const SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`;
    const values = [this.search_query, this.formatted_query, this.latitude, this.longitude];

    return client.query(SQL, values)
      .then(result => {
        this.id = result.rows[0].id;
        return this;
      });
  }
};
function getLocation(req, res) {
  Location.lookupLocation({
    tableName: Location.tableName,
    query: req.query.data,
    cacheHit: function(res) {
      // console.log('got data from SQL data to be sent to client is', results.rows[0]);
      res.send(result.rows[0]);
    },
    cacheMiss: function() {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;
      
      return superagent.get(url)
        .then(result => {
          const location = new Location(this.query, result);
          location.save()
            .then(location => res.send(location));
          console.log('Data to be sent to client from api is', data);
        })
        .catch(error => handleError(error));
    }
  });
}

// ==============================Weather Api==========================================
function Weather(day) {
  this.tableName = 'weathers';
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.addedToDB = Date.now();
}

Weather.tableName = 'weathers';
Weather.lookup = lookup;
Weather.delByLocId = delByLocId;

Weather.prototype = {
  save: function(id) {
    const SQL = `INSERT INTO ${this.tableName} (forecast, time, addedToDB, location_id) VALUES ($1, $2, $3, $4);`;
    const values = [this.forecast, this.time, this.addedToDB, location_id];

    client.query(SQL, values);
  }
}
function getWeather(req, res) {
  Weather.lookup({
    tableName: Weather.tableName,

    location: req.query.data.id,

    cacheHit: function(result) {
      let freshnessInMin = (Date.now() - result.rows[0].created_at) / (1000 * 60);
      if(freshnessInMin > 30) {
        Weather.delByLocId(Weather.tableName, req.query.data.id);
        this.cacheMiss();
      } else {
        res.send(result.rows);
      }
    },

    cacheMiss: function() {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      return superagent.get(url)
        .then(result => {
          const weatherSummaries = result.body.daily.data.map(day => {
            const summary = new Weather(day);
            summary.save(req.query.data.id);
            return summary;
          });
          res.send(weatherSummaries);
        })
        .catch(error => handleError(error, res));
    }
  })
}

// ==============================Restraunt Api==========================================
function Yelp(business) {
  this.tableName = 'yelp';
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
  this.addedToDB = Date.now();
}

Yelp.tableName = 'yelp';
Yelp.lookup = lookup;
Yelp.delByLocId = delByLocId;

Yelp.prototype = {
  save: function(id) {
    const SQL = `INSERT INTO ${this.tableName} (name, image_url, price, rating, url, addedToDB, id) VALUES ($1, $2, $3, $4, $5, $6, $7);`;
    const values = [this.name, this.image_url, this.price, this.rating, this.url, this.addedToDB, id];

    client.query(SQL, values);
  }
}

function getRestaurants(req, res) {
  Yelp.lookup({
    tableName: Yelp.tableName,

    location: req.query.data.id,

    cacheHit: function(result) {
      let freshnessInHours = (Date.now() - result.rows[0].created_at) / (1000 * 60 * 60);
      if(freshnessInHours > 24) {
        Yelp.delByLocId(Yelp.tableName, req.query.data.id);
        this.cacheMiss();
      } else {
        res.send(result.rows);
      }
    },

    cacheMiss: function() {
      const url = `https://api.yelp.com/v3/businesses/search?location=${req.query.data.search_query}`;

      superagent.get(url)
        .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
        .then(result => {
          const yelpSummaries = result.body.businesses.map(business => {
            const review = new Yelp(business);
            review.save(req.query.data.id);
            return review;
          });

          res.send(yelpSummaries);
        })
        .catch(error => handleError(error, res));
    }
  })
}

// =============================Movie API==============================================
function Movie(data) {
  this.tableName = 'moviedb';
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = 'https://image.tmdb.org/t/p/w370_and_h556_bestv2/' + data.poster_path;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
  this.addedToDB = Date.now();
}

Movie.tableName = 'moviedb';
Movie.lookup = lookup;
Movie.delByLocId = delByLocId;

Movie.prototype = {
  save: function(id) {
    const SQL = `INSERT INTO ${this.tableName} (title, overview, average_votes, total_votes, image_url, popularity, released_on, addedToDB, id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
    const values = [this.title, this.overview, this.average_votes, this.total_votes, this.image_url, this.popularity, this.released_on, this.addedToDB, id];

    client.query(SQL, values);
  }
}

function getMovies(req, res) {
  const movieHandler = {
    location: req.query.data,
    cacheHit: (result) => {
      res.send(result.rows);
    },
    cacheMiss: () => {
      Movie.fetchMovies(req.query.data)
        .then(results => res.send(results))
        .catch(error => handleError(error));
    },
  };
  Movie.lookupMovies(movieHandler);
}

function getMovies(req, res) {
  Movie.lookup({
    tableName: Movie.tableName,

    location: req.query.data.id,

    cacheHit: function(result) {
      let freshnessInDays = (Date.now() - result.rows[0].addedToDB) / (1000 * 60 * 60 * 24);
      if(freshnessInDays > 30) {
        Movie.delByLocId(Movie.tableName, req.query.data.id);
        this.cacheMiss();
      } else {
        res.send(result.rows);
      }
    },

    cacheMiss: function() {
      const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&language=en-US&page=1&query=${req.query.data.search_query}`;

      superagent.get(url)
        .then(result => {
          const movieSummaries = result.body.results.map(movie => {
            const details = new Movie(movie);
            details.save(req.query.data.id);
            return details;
          });

          res.send(movieSummaries);
        })
        .catch(error => handleError(error, res));
    }
  })
}

// =============================Meetup API==============================================
function Meetup(meetup) {
  this.tableName = 'meetups';
  this.link = meetup.link;
  this.name = meetup.group.name;
  this.creation_date = new Date(meetup.group.created).toString().slice(0, 15);
  this.host = meetup.group.who;
  this.created_at = Date.now();
}

Meetup.tableName = 'meetups';
Meetup.lookup = lookup;
Meetup.delByLocId = delByLocId;

Meetup.prototype = {
  save: function(id) {
    const SQL = `INSERT INTO ${this.tableName} (link, name, creation_date, host, addedToDB, id) VALUES ($1, $2, $3, $4, $5, $6);`;
    const values = [this.link, this.name, this.creation_date, this.host, this.addedToDB, id];

    client.query(SQL, values);
  }
}
function getMeetUps(req, res) {
  Meetup.lookup({
    tableName: Meetup.tableName,

    location: req.query.data.id,

    cacheHit: function(result) {
      let ageOfResultsInHours = (Date.now() - result.rows[0].addedToDB) / (1000 * 60 * 60);
      if(ageOfResultsInHours > 6) {
        Meetup.delByLocId(Meetup.tableName, req.query.data.id);
        this.cacheMiss();
      } else {
        res.send(result.rows);
      }
    },

    cacheMiss: function() {
      const url = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${req.query.data.longitude}&page=20&lat=${req.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`

      superagent.get(url)
        .then(result => {
          const meetups = result.body.events.map(meetup => {
            const event = new Meetup(meetup);
            event.save(req.query.data.id);
            return event;
          });

          res.send(meetups);
        })
        .catch(error => handleError(error, res));
    }
  })
}

// =============================Trails API==============================================
function getTrails(req, res) {
  Trail.lookup({
    tableName: Trail.tableName,

    location: req.query.data.id,

    cacheHit: function(result) {
      let freshnessInDays = (Date.now() - result.rows[0].created_at) / (1000 * 60 * 60 * 24);
      if(freshnessInDays > 7) {
        Trail.delByLocId(Trail.tableName, req.query.data.id);
        this.cacheMiss();
      } else {
        res.send(result.rows);
      }
    },

    cacheMiss: function() {
      const url = `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}&lon=${req.query.data.longitude}&maxDistance=200&key=${process.env.TRAIL_API_KEY}`;

      superagent.get(url)
        .then(result => {
          const trails = result.body.trails.map(trail => {
            const condition = new Trail(trail);
            condition.save(req.query.data.id);
            return condition;
          });

          res.send(trails);
        })
        .catch(error => handleError(error, res));
    }
  })
}
