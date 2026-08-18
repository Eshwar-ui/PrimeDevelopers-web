import { Section, TextField, TextAreaField, SelectField } from '../components/Field'
import ImageUploader from '../components/ImageUploader'
import RepeatableList from '../components/RepeatableList'
import { SERVICE_ICONS } from '../../lib/serviceIcons'

// Shared hint for the *word* → italic accent-color convention used across
// headings, so admins get the same visual flourish as the original hardcoded copy.
const emphasisHint = 'Wrap a word in *asterisks* to render it italic in accent color, e.g. "We build the *landmarks* of Texas".'

export const SECTIONS = [
  {
    key: 'hero',
    label: 'Hero',
    description: 'Homepage full-screen intro banner.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Button label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
            <TextField label="Button link" value={value.ctaHref} onChange={(ctaHref) => onChange({ ctaHref })} />
          </div>
        </Section>
        <Section title="Slides" description="Full-bleed background photos that rotate on the homepage.">
          <RepeatableList
            items={value.slides}
            onChange={(slides) => onChange({ slides })}
            makeItem={() => ({ image: '', place: '', kind: '' })}
            addLabel="Add slide"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader value={item.image} onChange={(image) => set({ ...item, image })} folder="site/hero" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Place" value={item.place} onChange={(place) => set({ ...item, place })} />
                  <TextField label="Type" value={item.kind} onChange={(kind) => set({ ...item, kind })} />
                </div>
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'marquee',
    label: 'Marquee',
    description: 'Scrolling client-logo strip.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Logos">
          <RepeatableList
            items={value.logos}
            onChange={(logos) => onChange({ logos })}
            makeItem={() => ({ image: '', alt: '' })}
            addLabel="Add logo"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader value={item.image} onChange={(image) => set({ ...item, image })} folder="site/logos" />
                <TextField label="Alt text" value={item.alt} onChange={(alt) => set({ ...item, alt })} />
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'about_home',
    label: 'About (homepage section)',
    description: 'The "Ethos" section on the homepage.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.paragraph1} onChange={(paragraph1) => onChange({ paragraph1 })} />
        </Section>
        <Section title="Film" description="Plays on click. Leave the link empty to show the still on its own.">
          <ImageUploader label="Poster still" value={value.videoPoster} onChange={(videoPoster) => onChange({ videoPoster })} folder="site/about" />
          <TextField label="Video link" value={value.videoUrl} onChange={(videoUrl) => onChange({ videoUrl })} />
          <p className="-mt-3 text-[11px] text-bone-3">A YouTube or Vimeo link, or a direct link to an .mp4 file.</p>
        </Section>
        <Section title="Stats">
          <RepeatableList
            items={value.stats}
            onChange={(stats) => onChange({ stats })}
            makeItem={() => ({ value: '', label: '' })}
            addLabel="Add stat"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Value" type="number" value={item.value} onChange={(v) => set({ ...item, value: v })} />
                <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'properties_home',
    label: 'Properties (homepage teaser)',
    description: 'Heading above the homepage property teaser — properties shown there come from the Properties list.',
    Editor: ({ value, onChange }) => (
      <Section title="Copy">
        <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
        <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
      </Section>
    ),
  },
  {
    key: 'services_home',
    label: 'Services (homepage strip)',
    description: 'The four support promises between the property teaser and the gallery.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
        </Section>
        <Section title="Cards">
          <RepeatableList
            items={value.items}
            onChange={(items) => onChange({ items })}
            makeItem={() => ({ icon: SERVICE_ICONS[0], title: '', body: '' })}
            addLabel="Add card"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Icon" value={item.icon} onChange={(icon) => set({ ...item, icon })} options={SERVICE_ICONS} />
                  <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
                </div>
                <TextAreaField label="Body" value={item.body} onChange={(body) => set({ ...item, body })} />
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'academy',
    label: 'Property Academy',
    description: 'Plain-language real-estate terms, examples, and their dedicated YouTube videos.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Introduction">
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" rows={3} value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section title="Terms" description="Use a short, unique URL slug. Related terms are comma-separated slugs, such as flex-space,parking-ratio.">
          <RepeatableList
            items={value.terms ?? []}
            onChange={(terms) => onChange({ terms })}
            makeItem={() => ({ slug: '', term: '', category: '', videoUrl: '', shortDefinition: '', explanation: '', example: '', whyItMatters: '', related: '' })}
            addLabel="Add term"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Term" value={item.term} onChange={(term) => set({ ...item, term })} />
                  <TextField label="URL slug" value={item.slug} onChange={(slug) => set({ ...item, slug })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Category" value={item.category} onChange={(category) => set({ ...item, category })} />
                  <TextField label="YouTube link" value={item.videoUrl} onChange={(videoUrl) => set({ ...item, videoUrl })} />
                </div>
                <TextAreaField label="Short definition" rows={2} value={item.shortDefinition} onChange={(shortDefinition) => set({ ...item, shortDefinition })} />
                <TextAreaField label="Full explanation" rows={5} value={item.explanation} onChange={(explanation) => set({ ...item, explanation })} />
                <TextAreaField label="Practical example" rows={3} value={item.example} onChange={(example) => set({ ...item, example })} />
                <TextAreaField label="Why it matters" rows={3} value={item.whyItMatters} onChange={(whyItMatters) => set({ ...item, whyItMatters })} />
                <TextField label="Related term slugs" value={item.related} onChange={(related) => set({ ...item, related })} />
              </div>
            )}
          />
        </Section>
      </>
    ),
  },  {
    key: 'gallery',
    label: 'Gallery',
    description: 'The homepage photo gallery — photos shown there come from the Properties list.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" rows={4} value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section title="Highlights" description="The numbered list under the paragraph — numbering is automatic.">
          <RepeatableList
            items={value.features}
            onChange={(features) => onChange({ features })}
            makeItem={() => ({ title: '' })}
            addLabel="Add highlight"
            renderItem={(item, set) => (
              <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    description: 'Client quotes on the homepage.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Heading" value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section title="Quotes">
          <RepeatableList
            items={value.items}
            onChange={(items) => onChange({ items })}
            makeItem={() => ({ quote: '', name: '', role: '', avatar: '', rating: 5 })}
            addLabel="Add testimonial"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <TextAreaField label="Quote" value={item.quote} onChange={(quote) => set({ ...item, quote })} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                  <TextField label="Role" value={item.role} onChange={(role) => set({ ...item, role })} />
                </div>
                <TextField label="Rating (0–5)" type="number" value={item.rating ?? 5} onChange={(rating) => set({ ...item, rating })} />
                <ImageUploader label="Portrait" value={item.avatar} onChange={(avatar) => set({ ...item, avatar })} folder="site/testimonials" />
                <p className="-mt-3 text-[11px] text-bone-3">Optional — initials are shown when no portrait is uploaded.</p>
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'news_home',
    label: 'News (homepage teaser)',
    description: 'Heading above the homepage news teaser — the posts themselves come from the News list.',
    Editor: ({ value, onChange }) => (
      <Section title="Copy">
        <TextField label="Heading" value={value.heading} onChange={(heading) => onChange({ heading })} />
        <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
      </Section>
    ),
  },
  {
    key: 'cta_home',
    label: 'Closing call to action',
    description: 'The dark panel that closes the homepage.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Button label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
            <TextField label="Button link" value={value.ctaHref} onChange={(ctaHref) => onChange({ ctaHref })} />
          </div>
        </Section>
        <Section title="Photo">
          <ImageUploader label="Panel image" value={value.image} onChange={(image) => onChange({ image })} folder="site/cta" />
        </Section>
      </>
    ),
  },
  {
    key: 'navbar',
    label: 'Navigation',
    description: 'Top navigation links.',
    Editor: ({ value, onChange }) => (
      <Section title="Links">
        <RepeatableList
          items={value.links}
          onChange={(links) => onChange({ links })}
          makeItem={() => ({ label: '', to: '/' })}
          addLabel="Add link"
          renderItem={(item, set) => (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
              <TextField label="Route" value={item.to} onChange={(to) => set({ ...item, to })} />
            </div>
          )}
        />
      </Section>
    ),
  },
  {
    key: 'footer',
    label: 'Footer',
    description: 'Contact details and links in the footer.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Contact details">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Email" value={value.email} onChange={(email) => onChange({ email })} />
            <TextField label="Phone" value={value.phone} onChange={(phone) => onChange({ phone })} />
          </div>
          <TextField label="Studio address" value={value.studio} onChange={(studio) => onChange({ studio })} />
        </Section>
        <Section title="Quick links">
          <RepeatableList
            items={value.quickLinks}
            onChange={(quickLinks) => onChange({ quickLinks })}
            makeItem={() => ({ label: '', href: '/' })}
            addLabel="Add link"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                <TextField label="Link" value={item.href} onChange={(href) => set({ ...item, href })} />
              </div>
            )}
          />
        </Section>
        <Section title="Social links">
          <RepeatableList
            items={value.socials}
            onChange={(socials) => onChange({ socials })}
            makeItem={() => ({ label: '', href: '#' })}
            addLabel="Add social"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                <TextField label="Link" value={item.href} onChange={(href) => set({ ...item, href })} />
              </div>
            )}
          />
        </Section>
        <Section title="Copyright bar">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Left text" value={value.copyrightLeft} onChange={(copyrightLeft) => onChange({ copyrightLeft })} />
            <TextField label="Right text" value={value.copyrightRight} onChange={(copyrightRight) => onChange({ copyrightRight })} />
          </div>
        </Section>
      </>
    ),
  },
  {
    key: 'about_page',
    label: 'About page',
    description: 'The full /about page — hero, firm story, principles, and founders.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heroHeading} onChange={(heroHeading) => onChange({ heroHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
          <ImageUploader label="Hero image" value={value.heroImage} onChange={(heroImage) => onChange({ heroImage })} folder="site/about" />
        </Section>
        <Section title="The firm">
          <TextAreaField label="Heading" rows={2} value={value.firmHeading} onChange={(firmHeading) => onChange({ firmHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph 1" value={value.firmParagraph1} onChange={(firmParagraph1) => onChange({ firmParagraph1 })} />
          <TextAreaField label="Paragraph 2" value={value.firmParagraph2} onChange={(firmParagraph2) => onChange({ firmParagraph2 })} />
          <TextField label="Button label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
        </Section>
        <Section title="Stats">
          <RepeatableList
            items={value.stats}
            onChange={(stats) => onChange({ stats })}
            makeItem={() => ({ value: '', label: '' })}
            addLabel="Add stat"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Value" type="number" value={item.value} onChange={(v) => set({ ...item, value: v })} />
                <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
              </div>
            )}
          />
        </Section>
        <Section title="Principles">
          <RepeatableList
            items={value.principles}
            onChange={(principles) => onChange({ principles })}
            makeItem={() => ({ title: '', body: '' })}
            addLabel="Add principle"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
                <TextAreaField label="Body" value={item.body} onChange={(body) => set({ ...item, body })} />
              </div>
            )}
          />
        </Section>
        <Section title="Founders">
          <RepeatableList
            items={value.founders}
            onChange={(founders) => onChange({ founders })}
            makeItem={() => ({ name: '', role: '', image: '' })}
            addLabel="Add founder"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader value={item.image} onChange={(image) => set({ ...item, image })} folder="site/founders" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                  <TextField label="Role" value={item.role} onChange={(role) => set({ ...item, role })} />
                </div>
              </div>
            )}
          />
          <TextAreaField label="Closing note" value={value.foundersClosing} onChange={(foundersClosing) => onChange({ foundersClosing })} />
        </Section>
        <Section title="Closing band">
          <TextAreaField label="Heading" rows={2} value={value.closingHeading} onChange={(closingHeading) => onChange({ closingHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <ImageUploader label="Background image" value={value.closingImage} onChange={(closingImage) => onChange({ closingImage })} folder="site/about" />
        </Section>
      </>
    ),
  },
  {
    key: 'contact_page',
    label: 'Contact page',
    description: 'The /contact page — hero copy and contact details.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heroHeading} onChange={(heroHeading) => onChange({ heroHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
        </Section>
        <Section title="Contact details">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Email" value={value.email} onChange={(email) => onChange({ email })} />
            <TextField label="Phone" value={value.phone} onChange={(phone) => onChange({ phone })} />
          </div>
          <TextField label="Location" value={value.location} onChange={(location) => onChange({ location })} />
        </Section>
        <Section title="Social links">
          <RepeatableList
            items={value.socials}
            onChange={(socials) => onChange({ socials })}
            makeItem={() => ({ label: '', href: '#' })}
            addLabel="Add social"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                <TextField label="Link" value={item.href} onChange={(href) => set({ ...item, href })} />
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'enterprise_page',
    label: 'Enterprise page',
    description: 'The /enterprise page — hero, capabilities, record, and closing band.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heroHeading} onChange={(heroHeading) => onChange({ heroHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
          <ImageUploader label="Banner image" value={value.heroImage} onChange={(heroImage) => onChange({ heroImage })} folder="site/enterprise" />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Button label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
            <TextField label="Button link" value={value.ctaHref} onChange={(ctaHref) => onChange({ ctaHref })} />
          </div>
        </Section>
        <Section title="Capabilities">
          <TextAreaField label="Heading" rows={2} value={value.capabilitiesHeading} onChange={(capabilitiesHeading) => onChange({ capabilitiesHeading })} />
          <RepeatableList
            items={value.capabilities}
            onChange={(capabilities) => onChange({ capabilities })}
            makeItem={() => ({ title: '', body: '', image: '', href: '' })}
            addLabel="Add capability"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
                <TextAreaField label="Body" value={item.body} onChange={(body) => set({ ...item, body })} />
                <ImageUploader label="Service image" value={item.image} onChange={(image) => set({ ...item, image })} folder="site/enterprise/services" />
                <TextField label="Service link" value={item.href} onChange={(href) => set({ ...item, href })} />
              </div>
            )}
          />
        </Section>
        <Section title="Record">
          <RepeatableList
            items={value.stats}
            onChange={(stats) => onChange({ stats })}
            makeItem={() => ({ value: '', label: '' })}
            addLabel="Add stat"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Value" value={item.value} onChange={(v) => set({ ...item, value: v })} />
                <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
              </div>
            )}
          />
        </Section>
        <Section title="Closing band">
          <TextAreaField label="Heading" rows={2} value={value.closingHeading} onChange={(closingHeading) => onChange({ closingHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Button label" value={value.closingLabel} onChange={(closingLabel) => onChange({ closingLabel })} />
            <TextField label="Button link" value={value.closingHref} onChange={(closingHref) => onChange({ closingHref })} />
          </div>
        </Section>
      </>
    ),
  },
  {
    key: 'properties_page',
    label: 'Properties page',
    description: 'Hero, buttons and collection copy on the /properties listing page.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heroHeading} onChange={(heroHeading) => onChange({ heroHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
        </Section>
        <Section title="Hero buttons">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Primary label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
            <TextField label="Primary link" value={value.ctaHref} onChange={(ctaHref) => onChange({ ctaHref })} />
            <TextField label="Secondary label" value={value.ctaSecondaryLabel} onChange={(ctaSecondaryLabel) => onChange({ ctaSecondaryLabel })} />
            <TextField label="Secondary link" value={value.ctaSecondaryHref} onChange={(ctaSecondaryHref) => onChange({ ctaSecondaryHref })} />
          </div>
        </Section>
        {/* No field for the hero band: it plays the published listings' own
            photographs, so there is nothing to upload and nothing that can
            fall out of step with the grid below it. */}
        <Section title="The collection">
          <TextField label="Eyebrow" value={value.curatedEyebrow} onChange={(curatedEyebrow) => onChange({ curatedEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.curatedHeading} onChange={(curatedHeading) => onChange({ curatedHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.curatedParagraph} onChange={(curatedParagraph) => onChange({ curatedParagraph })} />
        </Section>
      </>
    ),
  },
  {
    key: 'news_page',
    label: 'News page',
    description: 'Hero copy on the /news listing page.',
    Editor: ({ value, onChange }) => (
      <Section title="Hero">
        <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
        <TextAreaField label="Heading" rows={2} value={value.heroHeading} onChange={(heroHeading) => onChange({ heroHeading })} />
        <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
        <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
      </Section>
    ),
  },
]
