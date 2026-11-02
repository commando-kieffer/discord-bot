export const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

// Rien de ce qui ressemble à un secret ne doit finir dans les logs (clé d'API, token Discord, mot de passe...)
const SECRET_KEY = /token|passw|secret|api[-_]?key|authorization|cookie/i
const MAX_DEPTH = 5

export function redact(value, depth = 0) {
	if (depth > MAX_DEPTH) return '[...]'
	if (value instanceof Error) return serializeError(value, depth)
	if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
	if (value && typeof value === 'object') {
		if (Buffer.isBuffer(value)) return `[Buffer ${value.length} octets]`
		const out = {}
		for (const [key, item] of Object.entries(value)) {
			out[key] = SECRET_KEY.test(key) ? '[masqué]' : redact(item, depth + 1)
		}
		return out
	}
	return value
}

// Seuls ces champs sont repris : une erreur axios contient par exemple les en-têtes de la requête, donc la clé d'API
const ERROR_FIELDS = ['code', 'errno', 'sqlState', 'status', 'method', 'endpoint', 'path']

export function serializeError(err, depth = 0) {
	if (!(err instanceof Error)) return redact(err, depth + 1)

	const out = { name: err.name, message: err.message }
	for (const field of ERROR_FIELDS) {
		if (err[field] !== undefined) out[field] = err[field]
	}
	if (err.details !== undefined) out.details = redact(err.details, depth + 1)
	if (err.stack) out.stack = err.stack
	if (err.cause !== undefined && depth < MAX_DEPTH) out.cause = serializeError(err.cause, depth + 1)
	return out
}

// Les piles d'appels sont écrites sous la ligne de log plutôt que dans le JSON, pour rester lisibles dans pm2
function extractStacks(value, stacks = []) {
	if (Array.isArray(value)) {
		value.forEach((item) => extractStacks(item, stacks))
	} else if (value && typeof value === 'object') {
		if (typeof value.stack === 'string') {
			stacks.push(value.stack)
			delete value.stack
		}
		Object.values(value).forEach((item) => extractStacks(item, stacks))
	}
	return stacks
}

const defaultWrite = (level, line) => {
	if (level === 'error' || level === 'warn') console.error(line)
	else console.log(line)
}

export function createLogger({ level = 'info', scope = '', write = defaultWrite, now = () => new Date() } = {}) {
	const threshold = LEVELS[level] ?? LEVELS.info

	const log = (lvl) => (message, context) => {
		if (LEVELS[lvl] < threshold) return

		let line = `${now().toISOString()} ${lvl.toUpperCase().padEnd(5)}${scope ? ` [${scope}]` : ''} ${message}`

		if (context !== undefined) {
			const safe = redact(context)
			const stacks = extractStacks(safe)
			line += ` ${JSON.stringify(safe)}`
			for (const stack of stacks) {
				line += `\n${stack.replace(/^/gm, '    ')}`
			}
		}

		write(lvl, line)
	}

	return {
		level,
		debug: log('debug'),
		info: log('info'),
		warn: log('warn'),
		error: log('error'),
		child: (childScope) =>
			createLogger({ level, write, now, scope: scope ? `${scope}:${childScope}` : childScope }),
	}
}
