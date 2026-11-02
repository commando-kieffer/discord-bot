import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFunFeature } from '../../src/features/fun.js'

describe('pile ou face', () => {
	it('tombe sur PILE ou FACE avec l\'image correspondante', async () => {
		assert.deepEqual(await createFunFeature({ random: () => 0.1 }).coinFlip(), {
			status: 200,
			message: "# C'est tombé sur PILE !",
			picture: 'piece-ck-tail.jpeg',
		})
		assert.deepEqual(await createFunFeature({ random: () => 0.9 }).coinFlip(), {
			status: 200,
			message: "# C'est tombé sur FACE !",
			picture: 'piece-ck-head.jpeg',
		})
	})

	it('fonctionne avec le hasard par défaut', async () => {
		const { message } = await createFunFeature().coinFlip()
		assert.match(message, /PILE|FACE/)
	})
})

describe('emoji au hasard', () => {
	it('pioche dans la liste', () => {
		assert.equal(createFunFeature({ random: () => 0 }).getRandomEmoji(), '😭')
		assert.equal(createFunFeature({ random: () => 0.999 }).getRandomEmoji(), '✨')
	})
})
