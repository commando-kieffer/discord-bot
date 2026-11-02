// Valeurs saisies dans un formulaire, indexées par custom_id.
// Discord renvoie soit des lignes d'actions (ancien format), soit des « labels » qui contiennent un seul champ.
// Un champ texte donne une chaîne (`value`), une liste déroulante un tableau (`values`).
export function readModalValues(components = []) {
	const values = {}

	const read = (component) => {
		if (!component?.custom_id) return
		values[component.custom_id] = component.values ?? component.value
	}

	for (const row of components) {
		if (Array.isArray(row?.components)) row.components.forEach(read)
		else if (row?.component) read(row.component)
	}

	return values
}
