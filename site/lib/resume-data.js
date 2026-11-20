// Structured résumé data for Kayzee XP.
// Source: the master CV (~/skill/cv/Kshitiz_Mittal_CV.tex). Only facts from that file.
// Deliberately excluded: phone number, any visa / immigration information.
// Email and LinkedIn are NOT stored here: apps read them from ctx.site settings
// (contactEmail, linkedin) so the admin panel stays the single source for contact details.

export const resume = {
  name: 'Kshitiz Mittal',
  nickname: 'Kayzee',
  tagline: 'PR & Communications | Content & Social Media | Brand Storytelling',
  location: 'Dundalk, Co. Louth, Ireland',

  summary:
    "PR and content graduate (BA Hons Digital Marketing and Public Relations, DkIT) and Vice President of " +
    "DkIT Students' Union. Former co-founder of two local brands, doubling bookings at Sharpz Studio and growing Canopy " +
    "Coffee's average daily sales 48% in its second month. Writes press releases and campaign copy, shoots and " +
    'edits short-form and drone video, and presented research to a national panel in Dublin.',

  experience: [
    {
      title: 'Vice President',
      org: "DkIT Students' Union",
      location: 'Dundalk, Ireland',
      dates: 'Jul 2026 - Present',
      note: 'Previously International Officer (part-time), Sep 2025 - Jun 2026',
      bullets: [
        'Advocated for international students through casework, raising their issues directly with DkIT management.',
        'Organised orientation and welcome events for incoming international students, plus cultural events all year.',
        "Produced Students' Union communications and social media content for the student body.",
        "Represented students on college and Students' Union committees and boards.",
      ],
    },
    {
      title: 'Former Co-Founder',
      org: 'Canopy Coffee',
      location: 'Newry, Northern Ireland',
      dates: 'Jul 2026 - Oct 2026',
      bullets: [
        'Launched a roadside coffee trailer brand in Newry, opening for daily trading in Jul 2026.',
        'Tracked daily takings against break-even targets; average daily sales rose 48% from Aug to Sep 2026.',
        "Automated daily sales reports from SumUp till data to the team's WhatsApp group, showing peak and dead hours.",
        'Listed the brand on Google Business Profile and local directories, and shot its Instagram and TikTok content.',
        'Pitched a Newry influencer agency and scoped a gifted collaboration with 5-10 local food and drink micro-creators.',
      ],
    },
    {
      title: 'Former Co-Founder',
      org: 'Sharpz Studio',
      location: 'Crossmaglen and Dundalk',
      dates: 'Jan 2025 - Oct 2026',
      bullets: [
        'Doubled bookings across the Crossmaglen and Dundalk barbershops and increased the repeat-customer rate.',
        "Streamlined the content pipeline and hired external content creators to scale the brand's social output.",
        "Positioned the brand around men's mental health, running community events to build local engagement.",
        "Shot and edited the studio's photo and video content, including promotional and barber training-course shoots.",
      ],
    },
    {
      title: 'Marketing and Student Incubation',
      org: 'Regional Development Centre, DkIT',
      location: 'Dundalk, Ireland',
      dates: 'Jan 2025 - Aug 2025',
      bullets: [
        'Launched the marketing phase of a new student incubation programme, interviewing 25+ student applicants.',
        'Selected 5 student founders for a 12-week incubation phase; two later placed in the national top seven.',
      ],
    },
    {
      title: 'Student Researcher',
      org: 'N-TUTORR',
      location: 'Dundalk, Ireland',
      dates: 'Jun 2024 - Dec 2024',
      bullets: [
        'Researched the digital transformation of teaching and learning through surveys and case studies.',
        'Presented findings to a national panel in Dublin.',
      ],
    },
    {
      title: 'Content Creator and Drone Pilot',
      org: 'Eco Energy Improvements',
      location: 'Ireland',
      dates: 'Feb 2023 - Oct 2023',
      bullets: [
        "Filmed drone and ground showcase videos of every completed installation for the company's marketing.",
        'Wrote marketing copy to accompany the installation showcases.',
      ],
    },
    {
      title: 'Marketing Communications Consultant',
      org: 'Mini India',
      location: 'Dublin, Ireland',
      dates: 'Feb 2023 - Oct 2023',
      bullets: [
        'Advised on marketing communications for an Indian grocery retailer operating three locations.',
        'Managed inventory for 4,000+ products across all three locations.',
      ],
    },
  ],

  education: [
    {
      title: 'BA (Hons) Digital Marketing and Public Relations',
      org: 'Dundalk Institute of Technology (DkIT)',
      location: 'Dundalk, Ireland',
      dates: 'Sep 2022 - Oct 2026',
      note:
        'Second Class Honours (69%) at Level 8; First Class Honours (77%) at Level 7. ' +
        'Began in Computer Engineering at DkIT before moving into marketing and PR.',
    },
    {
      title: 'Senior Secondary Certificate (CBSE Class XII)',
      org: 'Kendriya Vidyalaya Dirang',
      location: 'Arunachal Pradesh, India',
      dates: 'May 2021',
      note: 'Physics, Chemistry, Mathematics, Computer Science, English, Hindi (Leaving Certificate equivalent).',
    },
  ],

  skills: [
    { label: 'PR and Communications', items: ['press releases', 'media relations', 'press kits', 'influencer outreach', 'event PR', 'campaign strategy', 'stakeholder engagement'] },
    { label: 'Content and Social Media', items: ['short-form video (Instagram Reels, TikTok)', 'video scripting', 'social hooks', 'UGC direction', 'brand storytelling', 'photography', 'drone piloting and aerial videography'] },
    { label: 'Digital Marketing and SEO', items: ['on-page SEO', 'keyword clustering', 'backlinks', 'Google Business Profile', 'lead funnels', 'paid social', 'CRM and email journeys', 'funnel analytics'] },
    { label: 'Research and Strategy', items: ['primary interviews', 'surveys', 'case studies', 'competitor analysis', 'SWOT', 'CAGE', 'Ansoff'] },
    { label: 'AI and Automation', items: ['prompt design', 'content agents', 'Google Sheets automations', 'content repurposing workflows', 'automated sales reporting'] },
  ],
  tools: ['DaVinci Resolve (colour grading)', 'Adobe Creative Suite', 'Meta Ads Manager', 'LinkedIn Ads', 'Google Analytics', 'Google Search Console', 'Mailchimp', 'Notion', 'Procreate'],
  languages: ['English', 'Hindi'],

  projects: [
    {
      title: 'Ribbon Runway PR Campaign',
      org: 'Breastcare by Alison',
      location: 'Dundalk, Ireland',
      dates: 'Mar 2024 - May 2024',
      bullets: [
        'Wrote press releases and promotional material for the Ribbon Runway event.',
        'Planned ticket sales tactics and produced the visual media used to promote the event.',
      ],
    },
    {
      title: 'SEO and Content',
      org: 'Visit Things to Do',
      location: 'Ireland',
      dates: 'May 2024 - Nov 2024',
      bullets: [
        'Moved the site from page three to page one of Google search results through on-page SEO and keyword work.',
        'Produced drone footage and design work, and ran lead generation for the business.',
      ],
    },
    {
      title: 'Freelance Photographer and Videographer',
      org: 'LéFotugrapher',
      location: 'Ireland',
      dates: '2013 - Present',
      bullets: ['Shot photo, video and drone work for local brands, including Visit Things to Do, Sharpz and Canopy Coffee.'],
    },
  ],

  interests: ['Drone piloting and aerial filming', 'photography', 'running', 'calisthenics', 'crisis communication', 'new technology'],

  // Short, CV-backed highlight cards (About Me window)
  highlights: [
    { key: 'su', title: "Vice President, DkIT Students' Union", text: 'VP since Jul 2026, after a year as International Officer. Produces SU communications and social content.' },
    { key: 'canopy', title: 'Former co-founder, Canopy Coffee', text: 'Roadside coffee trailer in Newry. Average daily sales up 48% from August to September 2026.' },
    { key: 'sharpz', title: 'Former co-founder, Sharpz Studio', text: 'Doubled bookings across two barbershops and grew the repeat-customer rate.' },
    { key: 'research', title: 'Presented to a national panel', text: 'N-TUTORR student researcher on the digital transformation of teaching, presented in Dublin.' },
  ],

  // Chips for the About Me window (all from the CV skills section)
  chips: ['Press releases', 'Media relations', 'Campaign strategy', 'Event PR', 'Influencer outreach', 'Short-form video', 'Brand storytelling', 'Photography', 'Drone video', 'On-page SEO', 'Paid social', 'DaVinci Resolve', 'Adobe Creative Suite', 'Meta Ads Manager'],
};

export default resume;
