import { Section, TextField, TextAreaField } from '../components/Field'
import ImageUploader from '../components/ImageUploader'
import RepeatableList from '../components/RepeatableList'

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
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
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
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
        </Section>
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
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
          <TextAreaField label="Paragraph 1" value={value.paragraph1} onChange={(paragraph1) => onChange({ paragraph1 })} />
          <TextAreaField label="Paragraph 2" value={value.paragraph2} onChange={(paragraph2) => onChange({ paragraph2 })} />
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
        <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
      </Section>
    ),
  },
  {
    key: 'gallery',
    label: 'Gallery',
    description: 'Heading above the homepage photo gallery — photos shown there come from the Properties list.',
    Editor: ({ value, onChange }) => (
      <Section title="Copy">
        <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
        <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
      </Section>
    ),
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    description: 'Client quotes on the homepage.',
    Editor: ({ value, onChange }) => (
      <Section title="Quotes">
        <RepeatableList
          items={value.items}
          onChange={(items) => onChange({ items })}
          makeItem={() => ({ quote: '', name: '', role: '' })}
          addLabel="Add testimonial"
          renderItem={(item, set) => (
            <div className="flex flex-col gap-3">
              <TextAreaField label="Quote" value={item.quote} onChange={(quote) => set({ ...item, quote })} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                <TextField label="Role" value={item.role} onChange={(role) => set({ ...item, role })} />
              </div>
            </div>
          )}
        />
      </Section>
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
    description: 'Contact details, links, and closing statement in the footer.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Contact details">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Email" value={value.email} onChange={(email) => onChange({ email })} />
            <TextField label="Phone" value={value.phone} onChange={(phone) => onChange({ phone })} />
          </div>
          <TextField label="Studio address" value={value.studio} onChange={(studio) => onChange({ studio })} />
        </Section>
        <Section title="Closing statement">
          <TextAreaField label="Heading" rows={2} value={value.ctaHeading} onChange={(ctaHeading) => onChange({ ctaHeading })} />
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
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
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
          <ImageUploader label="Hero image" value={value.heroImage} onChange={(heroImage) => onChange({ heroImage })} folder="site/about" />
        </Section>
        <Section title="The firm">
          <TextAreaField label="Heading" rows={2} value={value.firmHeading} onChange={(firmHeading) => onChange({ firmHeading })} />
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
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
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
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
          <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
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
    key: 'properties_page',
    label: 'Properties page',
    description: 'Hero copy on the /properties listing page.',
    Editor: ({ value, onChange }) => (
      <Section title="Hero">
        <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
        <TextAreaField label="Heading" rows={2} value={value.heroHeading} onChange={(heroHeading) => onChange({ heroHeading })} />
        <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
        <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
      </Section>
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
        <p className="-mt-3 text-[11px] text-bone/35">{emphasisHint}</p>
        <TextAreaField label="Paragraph" value={value.heroParagraph} onChange={(heroParagraph) => onChange({ heroParagraph })} />
      </Section>
    ),
  },
]
