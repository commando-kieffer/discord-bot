import 'dotenv/config'
import { REGISTERED_COMMANDS, REMOVED_COMMANDS } from './src/commands/definitions.js'
import { listMissingVars, loadConfig } from './src/config.js'
import { createContainer } from './src/container.js'
import { loadContent } from './src/content.js'
import { createLogger } from './src/logger.js'
import { createServer } from './src/server.js'

const logger = createLogger({ level: process.env.LOG_LEVEL })

let config, content
try {
	config = loadConfig()
	content = loadContent()
} catch (err) {
	logger.error('Démarrage impossible', { error: err })
	process.exit(1)
}

const missing = listMissingVars()
if (missing.length) {
	logger.warn(`Variables d'environnement absentes, certaines commandes échoueront : ${missing.join(', ')}`)
}

const container = createContainer({ config, content, logger })

const app = createServer({
	publicKey: config.discord.publicKey,
	handleInteraction: container.handleInteraction,
	logger: logger.child('http'),
})

const server = app.listen(config.port, () => {
	logger.info(`Listening on port ${config.port}`)

	container.registry.HasGuildCommands(config.discord.appId, config.discord.guildId, REGISTERED_COMMANDS, REMOVED_COMMANDS)
})

process.on('unhandledRejection', (reason) => {
	logger.error('Promesse rejetée sans gestion', { error: reason })
})

// pm2 envoie SIGINT à l'arrêt ou au redémarrage : on termine les requêtes en cours et on ferme la base
const shutdown = (signal) => {
	logger.info(`${signal} reçu, arrêt du bot`)
	server.close(async () => {
		await container.db.close().catch((err) => logger.error('Fermeture de la base impossible', { error: err }))
		process.exit(0)
	})
	setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
