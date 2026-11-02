import { TROOP } from './ranks.js'

// Sans elles le bot ne peut ni vérifier les requêtes de Discord ni lui répondre
const REQUIRED_VARS = ['APP_ID', 'GUILD_ID', 'DISCORD_TOKEN', 'PUBLIC_KEY']

// Le bot démarre sans elles, mais les commandes qui s'en servent échoueront
const EXPECTED_VARS = [
	'HOME_CHANNEL',
	'CK_DISCORD_ROOT',
	'CK_FORUM_API',
	'CK_FORUM_API_KEY',
	'DB_NAME',
	'DB_USER',
	'EM_ROLE',
	'QM1_ROLE',
	'QM2_ROLE',
	'CADET_ROLE',
	'INSTRUCTEUR_ROLE',
	'RECRUTEUR_ROLE',
	'MEMBRE_EQUIPAGE_ROLE',
	'CIVIL_EN_ATTENTE_ROLE',
	'ANCIEN_COMMANDO_ROLE',
	'RECRUITING_ROLE',
	'CADET_ROLE_FORUM',
	'CIVIL_ROLE_FORUM',
	'MEMBRE_EQUIPAGE_ROLE_FORUM',
	'SPE_FSL_ROLE_FORUM',
]

// Le forum de test tourne sous WAMP sans certificat : c'est le seul cas où l'API peut être appelée en http
const HTTP_FORUM_HOSTS = ['forum.commandokieffer.ch', 'localhost', '127.0.0.1']

export class ConfigError extends Error {
	constructor(message) {
		super(message)
		this.name = 'ConfigError'
	}
}

// La clé d'API du forum est une clé super-utilisateur : elle ne doit jamais circuler en clair vers la prod
export function checkForumApiUrl(value) {
	if (!value) return ''

	let url
	try {
		url = new URL(value)
	} catch {
		throw new ConfigError(`CK_FORUM_API n'est pas une URL valide : ${value}`)
	}

	const isHttps = url.protocol === 'https:'
	const isAllowedHttp = url.protocol === 'http:' && HTTP_FORUM_HOSTS.includes(url.hostname)

	if (!isHttps && !isAllowedHttp) {
		throw new ConfigError(
			`CK_FORUM_API doit être en https pour ${url.host} (http n'est accepté que pour ${HTTP_FORUM_HOSTS.join(', ')})`
		)
	}

	return value.replace(/\/+$/, '')
}

export function listMissingVars(env = process.env) {
	return EXPECTED_VARS.filter((name) => !env[name])
}

export function loadConfig(env = process.env) {
	const missing = REQUIRED_VARS.filter((name) => !env[name])
	if (missing.length) {
		throw new ConfigError(`Variables d'environnement manquantes : ${missing.join(', ')}`)
	}

	return deepFreeze({
		port: Number(env.PORT) || 3000,
		publicUrl: (env.CK_DISCORD_ROOT || '').replace(/\/+$/, ''),
		logLevel: env.LOG_LEVEL || 'info',
		discord: {
			appId: env.APP_ID,
			guildId: env.GUILD_ID,
			token: env.DISCORD_TOKEN,
			publicKey: env.PUBLIC_KEY,
			homeChannel: env.HOME_CHANNEL,
		},
		roles: {
			em: env.EM_ROLE,
			qm1: env.QM1_ROLE,
			qm2: env.QM2_ROLE,
			cadet: env.CADET_ROLE,
			instructeur: env.INSTRUCTEUR_ROLE,
			recruteur: env.RECRUTEUR_ROLE,
			membreEquipage: env.MEMBRE_EQUIPAGE_ROLE,
			civil: env.CIVIL_ROLE,
			civilEnAttente: env.CIVIL_EN_ATTENTE_ROLE,
			ancienCommando: env.ANCIEN_COMMANDO_ROLE,
			recruiting: env.RECRUITING_ROLE,
			troops: {
				[TROOP.T1]: { role: env.T1_ROLE, b1: env.T1_B1_ROLE, b2: env.T1_B2_ROLE },
				[TROOP.T8]: { role: env.T8_ROLE, b1: env.T8_B1_ROLE, b2: env.T8_B2_ROLE },
				[TROOP.T9]: { role: env.T9_ROLE, b1: env.T9_B1_ROLE, b2: env.T9_B2_ROLE },
				[TROOP.TQG]: { role: env.TQG_ROLE, b1: env.TQG_B1_ROLE, b2: env.TQG_B2_ROLE },
			},
		},
		forumGroups: {
			troops: {
				[TROOP.T1]: env.T1_ROLE_FORUM,
				[TROOP.T8]: env.T8_ROLE_FORUM,
				[TROOP.T9]: env.T9_ROLE_FORUM,
				[TROOP.TQG]: env.TQG_ROLE_FORUM,
			},
			b1: env.B1_ROLE_FORUM,
			b2: env.B2_ROLE_FORUM,
			cadet: env.CADET_ROLE_FORUM,
			civil: env.CIVIL_ROLE_FORUM,
			membreEquipage: env.MEMBRE_EQUIPAGE_ROLE_FORUM,
			speFsl: env.SPE_FSL_ROLE_FORUM,
		},
		forum: {
			apiUrl: checkForumApiUrl(env.CK_FORUM_API),
			apiKey: env.CK_FORUM_API_KEY || '',
		},
		db: {
			host: env.DB_HOST || 'localhost',
			user: env.DB_USER,
			password: env.DB_PASSWD,
			database: env.DB_NAME,
		},
	})
}

export function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}
