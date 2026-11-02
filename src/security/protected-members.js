// ohliger, bolloré
export const protectedIds = [
	'224193244555116545',
]

// Personne ne peut radier, enrôler ou recruter ces membres, ni toucher à leurs rôles
export const isProtected = (discordId) => !discordId || protectedIds.includes(discordId)
