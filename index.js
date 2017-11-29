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

const commands = {
	start(params) {
		sendMessage(`Send me your location or the name of a place you want to know about.`)
	},

	help(params) {
		sendMessage(`If you send me your current location, I'll see if I can find any data on air pollution in your area. You can also send me the name of a place or an address that you are interested in and I'll see if I can find any data for you.`)
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

function getMeasurements(location, radius = 5000) {
	return superagent.get(`https://api.openaq.org/v1/latest?coordinates=${location.latitude},${location.longitude}&radius=${radius}`).then((res) => {
		return res.body.results.filter((location) => {
			return location.measurements && location.measurements.find((mes) => { return new Date(mes.lastUpdated) > moment().subtract(1, 'days')})
		})
	})
}

function sendMeasurements(results) {
	if(results.length < 1) return sendMessage(`Sorry, I didn't find any data for your area...`)
	results.map((location) => {
		let text = location.measurements.map((mes) => {
			return `*${mes.parameter}* ${mes.value} ${mes.unit}`
		}).join(`
`)
		text += `
measured in ${location.location}, ${location.city}, ${location.country}`
		sendMessage(text)
	})
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
bot.on('message', function onMessage(msg) {
	message = msg;
	bot.sendChatAction(msg.chat.id, 'typing')
	if(message.entities && (cmds = message.entities.filter((e) => e.type === 'bot_command')).length > 0) {
		cmds.map((entity) => processCommand(entity))
	} else {
		superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?&address=${message.text}`).then((res) => {
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