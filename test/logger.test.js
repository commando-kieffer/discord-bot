import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLogger, redact, serializeError } from '../src/logger.js'

const capture = (options = {}) => {
	const lines = []
	const logger = createLogger({
		now: () => new Date('2026-11-03T10:00:00.000Z'),
		write: (level, line) => lines.push({ level, line }),
		...options,
	})
	return { logger, lines }
}

describe('createLogger', () => {
	it('écrit une ligne horodatée avec le niveau et le contexte', () => {
		const { logger, lines } = capture()
		logger.info('Commando radié', { commando: '123' })
		assert.deepEqual(lines, [
			{ level: 'info', line: '2026-11-03T10:00:00.000Z INFO  Commando radié {"commando":"123"}' },
		])
	})

	it('ignore les messages sous le niveau choisi', () => {
		const { logger, lines } = capture({ level: 'warn' })
		logger.debug('a')
		logger.info('b')
		logger.warn('c')
		logger.error('d')
		assert.deepEqual(
			lines.map((l) => l.level),
			['warn', 'error']
		)
	})

	it('utilise le niveau info si le niveau est inconnu', () => {
		const { logger, lines } = capture({ level: 'bavard' })
		logger.debug('a')
		logger.info('b')
		assert.equal(lines.length, 1)
	})

	it('n\'écrit rien en mode silencieux', () => {
		const { logger, lines } = capture({ level: 'silent' })
		logger.error('a')
		assert.equal(lines.length, 0)
	})

	it('préfixe les messages avec la portée, y compris imbriquée', () => {
		const { logger, lines } = capture()
		logger.child('forum').child('comptes').warn('attention')
		assert.match(lines[0].line, /WARN {2}\[forum:comptes\] attention$/)
	})

	it('écrit la pile d\'appel des erreurs sous la ligne', () => {
		const { logger, lines } = capture()
		const err = new Error('boom')
		logger.error('Échec', { error: err })
		const [first, ...rest] = lines[0].line.split('\n')
		assert.equal(first, '2026-11-03T10:00:00.000Z ERROR Échec {"error":{"name":"Error","message":"boom"}}')
		assert.match(rest[0], /^ {4}Error: boom$/)
		assert.ok(rest.length > 1)
	})

	it('masque les secrets du contexte', () => {
		const { logger, lines } = capture()
		logger.info('appel', { headers: { 'XF-Api-Key': 'cle', Authorization: 'Bot abc' }, token: 't', user: 'u' })
		assert.doesNotMatch(lines[0].line, /cle|Bot abc|"t"/)
		assert.match(lines[0].line, /"user":"u"/)
	})

	it('écrit les erreurs et avertissements sur stderr par défaut', (t) => {
		const err = t.mock.method(console, 'error', () => {})
		const out = t.mock.method(console, 'log', () => {})
		const logger = createLogger()
		logger.info('info')
		logger.warn('warn')
		logger.error('error')
		assert.equal(out.mock.callCount(), 1)
		assert.equal(err.mock.callCount(), 2)
	})
})

describe('serializeError', () => {
	it('garde les champs utiles, la cause et la pile', () => {
		const cause = Object.assign(new Error('connexion refusée'), { code: 'ECONNREFUSED' })
		const err = Object.assign(new Error('requête impossible', { cause }), { status: 502, details: { password: 'x', a: 1 } })
		const out = serializeError(err)
		assert.equal(out.message, 'requête impossible')
		assert.equal(out.status, 502)
		assert.deepEqual(out.details, { password: '[masqué]', a: 1 })
		assert.equal(out.cause.code, 'ECONNREFUSED')
		assert.ok(out.stack)
	})

	it('ne reprend pas les autres propriétés (en-têtes d\'une erreur axios par exemple)', () => {
		const err = Object.assign(new Error('Request failed'), { config: { headers: { 'XF-Api-Key': 'secret' } } })
		assert.equal(serializeError(err).config, undefined)
	})

	it('accepte une valeur qui n\'est pas une erreur', () => {
		assert.equal(serializeError('CODE U32'), 'CODE U32')
		assert.deepEqual(serializeError({ token: 'x' }), { token: '[masqué]' })
	})
})

describe('redact', () => {
	it('parcourt les tableaux et les objets imbriqués', () => {
		assert.deepEqual(redact([{ apiKey: 1, a: [{ api_key: 2, secret: 3, b: 4 }] }]), [
			{ apiKey: '[masqué]', a: [{ api_key: '[masqué]', secret: '[masqué]', b: 4 }] },
		])
	})

	it('résume les buffers et limite la profondeur', () => {
		assert.equal(redact(Buffer.from('abc')), '[Buffer 3 octets]')
		const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }
		assert.match(JSON.stringify(redact(deep)), /\[\.\.\.\]/)
	})
})
