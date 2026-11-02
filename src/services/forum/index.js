import { createRecruitmentRepository } from './recruitment.js'
import { createLinkRepository } from './link.js'
import { createUsersRepository } from './users.js'
import { createComplaintsRepository } from './complaints.js'

// Données du forum : les tables propres au CK sont lues et écrites en base, les comptes XenForo
// (pseudo, groupes) sont modifiés via l'API REST du forum
export function createForumService({ db, xenforo, logger, game }) {
	return {
		recruitment: createRecruitmentRepository({ db, xenforo, game, logger: logger.child('recrutement') }),
		link: createLinkRepository({ db, logger: logger.child('lien') }),
		users: createUsersRepository({ db, xenforo, logger: logger.child('comptes') }),
		complaints: createComplaintsRepository({ db, logger: logger.child('plaintes') }),
	}
}
