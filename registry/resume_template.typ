#set page(paper: "us-letter", margin: (x: 1.8cm, y: 1.5cm))
#set text(size: 10pt)
#set heading(numbering: none)

#align(center)[
  #text(size: 18pt, weight: "bold")[{{DISPLAY_NAME}}]
  #linebreak()
  {{SITE_TITLE}}
]

#v(0.6em)
*GitHub:* {{GITHUB_URL}} \
*Semantic Scholar:* {{SCHOLAR_URL}} \
*Timezone:* {{TIMEZONE}} \
*Refresh:* {{REFRESH_POLICY}} \
*Generated:* {{GENERATED_AT}}

= Research Summary
{{SUMMARY_LINE}}

= Experience
{{EXPERIENCE_BLOCK}}

= Program Map
{{PROGRAMS_BLOCK}}

= Selected Work
{{FEATURED_WORKS_BLOCK}}
