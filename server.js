'use strict'

// app dependiencies
const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const pg = require('pg');

require('dotenv').config();
const PORT = process.env.PORT;
const app = express();

app.use(cors());

app.get('/location', getLocation);
// app.get('/weather', getWeather);
// app.get('/yelp', getBusiness);

// ===========================DATABASE CONFIG====================================
const client = new pg.Client(process.env.DATABASE_URL)
client.connect();
client.on('err', err => console.log(err));

// ===========================Location api=======================================
function getLocation(req, res) {
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
        })
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
  let SQL = `
  INSERT INTO locations
    (search_query, formatted_query, latitude, longitude) 
    VALUES($1,$2,$3,$4) 
    RETURNING id;
    `;
  let values = Object.values(this);
  console.log("save function", values);
  return client.query(SQL, values);
};

Location.fetchLocation = (query) => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(_URL)
    .then(data => {
      console.log('got data from API');
      if (!data.body.results.length) {throw 'NO DATA';}
      else {
        console.log("inside of else in fetchLocation", data.body);
        let location = new Location(query, data.body.results[0]);
        return location.save()
          .then(result => {
            console.log("location", location);
            location.id = result.rows[0].id
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
}
// ==============================Weather Api==========================================
// function Weather(day) {
//   this.forecast = day.summary;
//   this.time = new Date(day.time * 1000).toDateString();
// }


// function getWeather(req, res) {
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

//   superagent.get(url)
//     .then(result => {
//       const weatherSummaries = result.body.daily.data.map(day => {
//         return new Weather(day);
//       });
//       res.send(weatherSummaries);
//     })
//     .catch(error => handleError(error));
// }
// ==============================Restraunt Api==========================================
// function Yelp(businesses) {
//   this.name = businesses.name;
//   this.image_url = businesses.image_url;
//   this.price = businesses.price;
//   this.rating = businesses.rating;
//   this.url = businesses.url;
// }


// function getBusiness(req, res) {
//   superagent.get(`https://api.yelp.com/v3/businesses/search?location=${req.query.data.search_query}/${req.query.data.latitude},${req.query.data.longitude}`)
//     .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
//     .then(result => {
//       const getBusiness = result.body.businesses.map(business => {
//         return new Yelp(business);
//       });
//       res.send(getBusiness);
//     })
//     .catch(error => handleError(error));
// }

// =============================Movie API==============================================
// function Movie(movie) {
//   this.title = movie.title;
//   this.overview = movie.overview;
//   this.total_votes = movie.total_votes;
//   this.image_url = 'https://image.tmdb.org/t/p/w370_and_h556_bestv2/' + movie.poster_path;
//   this.popularity = movie.popularity;
// }

// app.get('/movies', getMovie);

// function getMovie(req, res) {
//   const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${req.query.data.search_query}`;
//   superagent.get(url)
//     .then(result => {
//       const movieSum = result.body.results.map(movie => {
//         return new Movie(movie);
//       });
//       res.send(movieSum);
//     })
//     .catch(error => handleError(error));
// }

// Error Handler
function handleError(err, res) {
  console.error(err);
  if (res) res.satus(500).send('Sorry, something broke');
}

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
