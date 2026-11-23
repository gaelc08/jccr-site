---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
description: ""
event_slug: "{{ .File.ContentBaseName }}"
# Date de l'événement, entre guillemets (AAAA-MM-JJ) : il disparaît de la page Événements le lendemain.
event_date: "AAAA-MM-JJ"
---
