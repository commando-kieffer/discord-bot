const coin = [
	{ name: 'PILE', picture: 'piece-ck-tail.jpeg' },
	{ name: 'FACE', picture: 'piece-ck-head.jpeg' },
]

const emojiList = ['😭', '😄', '😌', '🤓', '😎', '😤', '🤖', '😶‍🌫️', '🌏', '👋', '🌊', '✨']

export function createFunFeature({ random = Math.random } = {}) {
	// Simple method that returns a random emoji from list
	const getRandomEmoji = () => emojiList[Math.floor(random() * emojiList.length)]

	const coinFlip = async () => {
		const bit = Math.floor(random() * 2)

		const message = `# C'est tombé sur ${coin[bit].name} !`
		const picture = coin[bit].picture

		return { status: 200, message, picture }
	}

	return { getRandomEmoji, coinFlip }
}
