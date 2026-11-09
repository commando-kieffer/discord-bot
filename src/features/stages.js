import { COMMAND_NAMES } from '../commands/definitions.js'
import { STAGE } from '../ranks.js'

// Un civil devient recrue (Enrôler), puis cadet (Lier au forum, questionnaires, Recruter).
// Renvoie le message qui explique pourquoi on s'arrête si le membre n'est pas au bon stade, sinon null.
export function checkStage(expected, stage, userId) {
	if (stage === expected) return null

	if (expected === STAGE.CIVIL) {
		return stage === STAGE.RECRUE
			? `<@${userId}> est déjà une recrue.`
			: `<@${userId}> fait déjà partie du CK : seul un civil peut être enrôlé.`
	}

	return stage === STAGE.CIVIL
		? `<@${userId}> n'est pas encore une recrue. Enrôlez-le d'abord avec « ${COMMAND_NAMES.ENROL} ».`
		: `<@${userId}> est déjà cadet ou plus, ce n'est pas une recrue.`
}
