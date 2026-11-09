import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COMMAND_NAMES } from '../../src/commands/definitions.js'
import { checkStage } from '../../src/features/stages.js'
import { STAGE } from '../../src/ranks.js'
import { ids } from '../support/fakes.js'

describe('refus selon le stade', () => {
	it('ne dit rien quand le membre est au bon stade', () => {
		assert.equal(checkStage(STAGE.CIVIL, STAGE.CIVIL, ids.target), null)
		assert.equal(checkStage(STAGE.RECRUE, STAGE.RECRUE, ids.target), null)
	})

	it('Enrôler : seul un civil peut être enrôlé', () => {
		assert.equal(checkStage(STAGE.CIVIL, STAGE.RECRUE, ids.target), `<@${ids.target}> est déjà une recrue.`)
		assert.equal(
			checkStage(STAGE.CIVIL, STAGE.MEMBER, ids.target),
			`<@${ids.target}> fait déjà partie du CK : seul un civil peut être enrôlé.`
		)
	})

	it('Lier au forum et Recruter : seule une recrue, et on dit quoi faire pour un civil', () => {
		assert.equal(
			checkStage(STAGE.RECRUE, STAGE.CIVIL, ids.target),
			`<@${ids.target}> n'est pas encore une recrue. Enrôlez-le d'abord avec « ${COMMAND_NAMES.ENROL} ».`
		)
		assert.equal(
			checkStage(STAGE.RECRUE, STAGE.MEMBER, ids.target),
			`<@${ids.target}> est déjà cadet ou plus, ce n'est pas une recrue.`
		)
	})
})
