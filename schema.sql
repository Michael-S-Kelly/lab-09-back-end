DROP TABLE IF EXISTS locations, weathers, yelp, moviedb;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude NUMERIC(8, 6),
  longitude NUMERIC(9, 6),
  addedToDB BIGINT
);

CREATE TABLE weathers (
id SERIAL PRIMARY KEY,
forcast VARCHAR(255),
time VARCHAR(255),
location_id INTEGER NOT NULL,
FOREIGN KEY (location_id) REFERENCES locations (id),
addedToDB BIGINT
);

CREATE TABLE yelp(
id SERIAL PRIMARY KEY,
name VARCHAR(255),
image_url VARCHAR(255),
price VARCHAR(255),
rating NUMERIC(2,1),
url VARCHAR(255),
addedToDB BIGINT,
location_id INTEGER NOT NULL,
FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE  moviedb (
id SERIAL PRIMARY KEY,
title VARCHAR(255),
overview VARCHAR(255),
average_votes NUMERIC(4,2), 
total_votes VARCHAR(255),
image_url VARCHAR(255),
popularity VARCHAR(255),
released_on CHAR(10),
addedToDB BIGINT,
location_id INTEGER NOT NULL,
FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE IF NOT EXISTS meetups (
  id SERIAL PRIMARY KEY, 
  link VARCHAR(255), 
  name VARCHAR(255), 
  creation_date CHAR(15), 
  host VARCHAR(255),
  addedToDB BIGINT
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE IF NOT EXISTS trails ( 
  id SERIAL PRIMARY KEY, 
  name VARCHAR(255), 
  location VARCHAR(255), 
  length NUMERIC(4, 1), 
  stars NUMERIC(2, 1), 
  star_votes INTEGER, 
  summary VARCHAR(255), 
  trail_url VARCHAR(255), 
  conditions TEXT, 
  condition_date CHAR(10), 
  condition_time CHAR(8),
  addedToDB BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id) 
);