import { createRecruitmentRepository } from './recruitment.js'
import { createLinkRepository } from './link.js'
import { createUsersRepository } from './users.js'
import { createComplaintsRepository } from './complaints.js'

export function createForumService({ db, xenforo, logger, game }) {
	return {
		recruitment: createRecruitmentRepository({ db, xenforo, game, logger: logger.child('recrutement') }),
		link: createLinkRepository({ db, logger: logger.child('lien') }),
		users: createUsersRepository({ db, logger: logger.child('comptes') }),
		complaints: createComplaintsRepository({ db, logger: logger.child('plaintes') }),
	}
}
