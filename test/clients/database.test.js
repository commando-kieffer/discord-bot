import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDatabase, isConnectionError } from '../../src/clients/database.js'
import { sqlError } from '../support/fakes.js'

const fakePool = (rows = []) => {
	const pool = { queries: [], ended: 0 }
	pool.query = async (sql, params) => {
		pool.queries.push({ sql, params })
		return [rows, []]
	}
	pool.end = async () => {
		pool.ended++
	}
	return pool
}

const config = { host: 'localhost', user: 'bot', password: 'pw', database: 'ck' }

describe('base de données', () => {
	it('ne crée le pool qu\'à la première requête, puis le réutilise', async () => {
		const pools = []
		const createPool = (options) => {
			const pool = fakePool([{ user_id: 1 }])
			pool.options = options
			pools.push(pool)
			return pool
		}
		const db = createDatabase(config, { createPool })
		assert.equal(pools.length, 0)

		assert.deepEqual(await db.query('SELECT ?', [1]), [{ user_id: 1 }])
		await db.query('SELECT 2')

		assert.equal(pools.length, 1)
		assert.deepEqual(pools[0].queries, [
			{ sql: 'SELECT ?', params: [1] },
			{ sql: 'SELECT 2', params: [] },
		])
		assert.equal(pools[0].options.host, 'localhost')
		assert.equal(pools[0].options.database, 'ck')
		assert.ok(pools[0].options.connectionLimit > 0)
	})

	it('ferme le pool, et en recrée un si besoin', async () => {
		const pools = []
		const db = createDatabase(config, { createPool: () => pools[pools.push(fakePool()) - 1] })
		await db.close()
		assert.equal(pools.length, 0)

		await db.query('SELECT 1')
		await db.close()
		assert.equal(pools[0].ended, 1)

		await db.query('SELECT 1')
		assert.equal(pools.length, 2)
	})

	it('reconnaît les erreurs de connexion', () => {
		for (const code of ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT']) {
			assert.ok(isConnectionError(sqlError(code)), code)
		}
		assert.ok(!isConnectionError(sqlError('ER_PARSE_ERROR')))
		assert.ok(!isConnectionError(new Error('x')))
		assert.ok(!isConnectionError(undefined))
	})
})
