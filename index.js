require('dotenv').config()
const superagent = require('superagent')
const moment = require('moment')
const TOKEN = process.env.TELEGRAM_TOKEN
const TelegramBot = require('node-telegram-bot-api')
const options = {
	webHook: {
		port: process.env.PORT
	}
}

const url = process.env.APP_URL
const bot = new TelegramBot(TOKEN, options)

bot.setWebHook(`${url}/bot${TOKEN}`)

const limits = {
	pm25: {low: 10, high: 25, unit: 'µg/m³'},
	pm10: {low: 20, high: 50, unit: 'µg/m³'},
	o3: {low: 100, high: 300, unit: 'µg/m³'},
	no2: {low: 40, high: 200, unit: 'µg/m³'},
	so2: {low: 20, high: 400, unit: 'µg/m³'},
	co: {low: 9999, high: 9999, unit: 'µg/m³'}
}

const commands = {
	start(params) {
		sendMessage(`Send me your location or the name of a place you want to know about.`)
	},

	help(params) {
		sendMessage(`If you send me your current location, I'll see if I can find any data on air pollution in your area. You can also send me the name of a place or an address that you are interested in and I'll see if I can find any data for you. Data comes from https://openaq.org/, a great platform for open air quality data. Recommended levels taken from WHO guideline http://www.who.int/.`)
	}
}

function processCommand(entity) {
	let cmd = message.text.substr(entity.offset + 1, entity.length - 1)
	let params = message.text.substr(entity.offset + entity.length + 1)
	try {
		commands[cmd](params)
	} catch (error) {
		console.error(error)
		sendMessage(`I didn't quite get that. Could you rephrase?`)
	}
}

function sendMessage(msg, options) {
	options = {
		parse_mode: 'Markdown',
		reply_markup: { remove_keyboard: true },
		...options,
	}
	bot.sendMessage(message.chat.id, msg, options)
}

function getMeasurements(location, radius = 25000) {
	return superagent.get(`https://api.openaq.org/v1/latest?coordinates=${location.latitude},${location.longitude}&radius=${radius}`).then((res) => {
		return res.body.results.filter((location) => {
			return location.measurements && location.measurements.find((mes) => new Date(mes.lastUpdated) > moment().subtract(1, 'days'))
		})
	})
}

function sendMeasurements(results) {
	if(results.length < 1) return sendMessage(`Sorry, I didn't find any data for your area...`)
	let measurements = results.sort((l1, l2) => l1.distance - l2.distance).reduce((result, location) => {
		location.measurements.filter((param) => new Date(param.lastUpdated) > moment().subtract(3, 'days')).map((param) => {
			if(result[param.parameter]) return
			result[param.parameter] = { ...param, distance: Math.round(location.distance / 10) / 100 };
			// result[param.parameter] = {
			// 	min: Math.min(result[param.parameter].min || Infinity, Math.round(param.value * 100) / 100),
			// 	max: Math.max(result[param.parameter].max || 0, Math.round(param.value * 100) / 100),
			// }
		})
		return result
	}, {})
	let text = ``
	for(let param in measurements) {
		text += `
*${param}* ${Math.round(measurements[param].value * 100) / 100} ${measurements[param].unit} `
		if(limits[param] && limits[param].unit === measurements[param].unit) {
			text += measurements[param].value > limits[param].high ? '😫 ' : measurements[param].value > limits[param].low ? '😐 ' : '🙂 '
		}
		text += `_(${new Date(measurements[param].lastUpdated).toLocaleString()} in ${measurements[param].distance} km)_`
	}
	sendMessage(text)
}

function sendAnswer(location) {
	getMeasurements(location).then((res) => {
		sendMeasurements(res)
	}, (err) => {
		console.log(err)
		sendMessage(`My data dealer seems to have problems. Please try again later.`)
	})
}

let message;
bot.on('text', function onMessage(msg) {
	message = msg;
	bot.sendChatAction(msg.chat.id, 'typing')
	if(message.entities && (cmds = message.entities.filter((e) => e.type === 'bot_command')).length > 0) {
		cmds.map((entity) => processCommand(entity))
	} else {
		superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?&address=${encodeURIComponent(message.text)}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`).then((res) => {
			if(res.body.results.length < 1) return sendMessage(`I didn't find that address. Could you rephrase?`)
			let location = res.body.results.pop()
			sendAnswer({latitude: location.geometry.location.lat, longitude: location.geometry.location.lng})
		})
	}
});

bot.on('location', (msg) => {
	message = msg
	bot.sendChatAction(msg.chat.id, 'typing')
	sendAnswer(msg.location)
})