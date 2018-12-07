'use strict';

// app dependiencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

require('dotenv').config();
const PORT = process.env.PORT;

const app = express();
app.use(cors());
// ===========================DATABASE CONFIG====================================
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));


app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getRestaurants);
app.get('/movies', getMovies);

// ===========================Location api=======================================
function getLocation(req, res) {
  console.log('hello from getlocation');
  const locationHandler = {
    query: req.query.data,
    cacheHit: (results) => {
      console.log('got data from SQL data to be sent to client is', results.rows[0]);
      res.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLocation(req.query.data)
        .then((data) => {
          console.log('Data to be sent to client from api is', data);
          res.send(data);
        });
    },
  };
  Location.lookupLocation(locationHandler);
}

function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

Location.prototype.save = function () {
  let SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1,$2,$3,$4) RETURNING id;`;
  let values = Object.values(this);
  console.log("save function", values);
  return client.query(SQL, values);
};

Location.fetchLocation = (query) => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(_URL)
    .then(data => {
      console.log('got data from API');
      if (!data.body.results.length) { throw 'NO DATA'; }
      else {
        console.log("inside of else in fetchLocation", data.body);
        let location = new Location(query, data.body.results[0]);
        return location.save()
          .then(result => {
            console.log("location", location);
            location.id = result.rows[0].id;
            console.log("location.id", result.rows[0]);
            return location;
          });
        return location;
      }
    });
};

Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query(SQL, values)
    .then(results => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      } else {
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};
// ==============================Weather Api==========================================
function getWeather(req, res) {
  const weatherHandler = {
    location: req.query.data,
    cacheHit: (result) => {
      res.send(result.rows);
    },
    cacheMiss: () => {
      Weather.fetchWeather(req.query.data)
        .then(results => res.send(results))
        .catch(error => handleError(error));
    },
  };
  Weather.lookupWeather(weatherHandler);
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toDateString();
}

Weather.prototype.save = function (id) {
  const SQL = `INSERT INTO weathers (forecast, time, location_id) VALUES ($1, $2, $3);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
};

Weather.fetchWeather = function (location) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;

  return superagent.get(url)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day => {
        const summary = new Weather(day);
        summary.save(location.id);
        return summary;

      });
      return weatherSummaries;

    });
};

Weather.lookupWeather = function (handler) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount > 0) {
        console.log('got weather data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('got weather data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};
// ==============================Restraunt Api==========================================
function getRestaurants(req, res) {
  const restaurantHandler = {
    location: req.query.data,
    cacheHit: (result) => {
      res.send(result.rows);
    },
    cacheMiss: () => {
      Restaurant.fetchRestaurant(req.query.data)
        .then(results => res.send(results))
        .catch(error => handleError(error));
    },
  };
  Restaurant.lookupRestaurant(restaurantHandler);
}

function Restaurant(business) {
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
}

Restaurant.prototype.save = function (id) {
  const SQL = `INSERT INTO restaurants (name, image_url, price, rating, url, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
};

Restaurant.fetchRestaurant = function (location) {
  const url = `https://api.yelp.com/v3/businesses/search?location=${location.search_query}`;

  return superagent.get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then(result => {
      const businesses = result.body.businesses.map(place => {
        const business = new Restaurant(place);
        business.save(location.id);
        return business;
      });
      return businesses;
    });
};

Restaurant.lookupRestaurant = function (handler) {
  const SQL = `SELECT * FROM restaurants WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount > 0) {
        console.log('got restaurant data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('got restaurant data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

// =============================Movie API==============================================
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

function Movie(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = 'https://image.tmdb.org/t/p/w370_and_h556_bestv2/' + data.poster_path;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}

Movie.prototype.save = function (id) {
  const SQL = `INSERT INTO movies (title, overview, vote_average, vote_count, image_url, popularity, release_date, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
};

Movie.fetchMovies = function(location) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${location.search_query}`;

  return superagent.get(url)
    .then(result => {
      const movieData = result.body.results.map(data => {
        const movie = new Movie(data);
        console.log(movie);
        movie.save(location.id);
        return movie;
      });
      return movieData;
    });
};

Movie.lookupMovies = function (handler) {
  const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount > 0) {
        console.log('got movie data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('got movie data from API');
        handler.cacheMiss();
      }
    }).catch(error => handleError(error));
};

// Error Handler
function handleError(err, res) {
  console.error(err);
  if (res) res.satus(500).send('Sorry, something broke');
}

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
