import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createComplaintsRepository } from '../../src/services/forum/complaints.js'
import { createFakeDb, createTestLogger, ids, sqlError } from '../support/fakes.js'

const setup = (result) => {
	const db = createFakeDb([[/INSERT INTO complaint \(signature, content\) VALUES \(TO_BASE64\(\?\), \?\)/, result]])
	return { db, complaints: createComplaintsRepository({ db, logger: createTestLogger() }) }
}

describe('plaintes', () => {
	it('enregistre la plainte avec la signature de son auteur', async () => {
		const { db, complaints } = setup({ affectedRows: 1 })
		await complaints.send(ids.requester, "Le capitaine est méchant'); DROP TABLE complaint; --")
		assert.deepEqual(db.calls[0].params, [ids.requester, "Le capitaine est méchant'); DROP TABLE complaint; --"])
	})

	it('signale une plainte non enregistrée', async () => {
		await assert.rejects(setup({ affectedRows: 0 }).complaints.send('1', 'x'), { message: 'Une erreur est survenue. CODE C29' })
		await assert.rejects(setup(sqlError('ECONNREFUSED')).complaints.send('1', 'x'), {
			message: 'Connexion à la base de données impossible. CODE C15',
		})
		await assert.rejects(setup(sqlError('ER_DATA_TOO_LONG')).complaints.send('1', 'x'), {
			message: 'Une erreur est survenue. CODE C24',
		})
	})
})
