# DontPolluteMe Bot

## About

This is a Bot for the Telegram instant messaging service that sends you air quality data retrieved from openaq.org.
It answers when you send it your current location or the name of a place that you want to know about.

## Get started

This bots runs in Telegram. If you just want to try it out go to https://t.me/DontPolluteMeBot.
If you want to run the bot on your own server download the code and run the `npm start` task.
You will have to set up the following environment variables to make it run properly:

`APP_URL` public url where your server can be reached

`GOOGLE_GEOCODING_API_KEY` an api key for the google geocoding api (it might actually run without it but you will be restricted to a small number of calls per minute)

`TELEGRAM_TOKEN` the api token of your telegram bot.

## Tech

This bot runs as a minimalistic node.js server that receives the Telegram messages send to it as POST requests.
If a location is sent, it simply looks up the latest data for the given coordinates in a 25 km radius.
If an address is sent, it fist calls the Google Maps Geocoding API (https://developers.google.com/maps/documentation/geocoding) to get the coordinates for the address.
The bot returns only data more recent than 3 days and preferres measurements close to the given coordinates.
