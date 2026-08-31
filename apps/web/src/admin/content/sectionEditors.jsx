import { Section, TextField, TextAreaField, SelectField, CheckboxField } from '../components/Field'
import ImageUploader from '../components/ImageUploader'
import RepeatableList from '../components/RepeatableList'
import { PLATFORM_KEYS } from '../../lib/platforms'
import { TIERS } from '../../lib/interiors'

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
    label: 'Partner logos',
    description:
      'Every partner mark, shown as one wall on the homepage. The grid sizes itself to how many there are, up to about twenty.',
    Editor: ({ value, onChange }) => (
      <Section
        title="Logos"
        description="Each mark sits on a white panel, which is what lets logos with a white background baked into the file sit alongside ones with a transparent background."
      >
        <RepeatableList
          items={value.logos}
          onChange={(logos) => onChange({ logos })}
          makeItem={() => ({ image: '', alt: '', darkPanel: false })}
          addLabel="Add logo"
          renderItem={(item, set) => (
            <div className="flex flex-col gap-3">
              <ImageUploader value={item.image} onChange={(image) => set({ ...item, image })} folder="site/logos" />
              <TextField label="Alt text" value={item.alt} onChange={(alt) => set({ ...item, alt })} />
              <CheckboxField
                label="Light logo — put it on a dark panel"
                value={item.darkPanel}
                onChange={(darkPanel) => set({ ...item, darkPanel })}
                hint="For a mark drawn in white or a very pale colour, which would disappear on the white panel. Almost every logo is dark artwork and should leave this unticked. If the file also has a dark background baked into it rather than being transparent, ask the brand for a transparent version — otherwise its box may not match the panel exactly."
              />
            </div>
          )}
        />
      </Section>
    ),
  },
  {
    key: 'about_home',
    label: 'Partners section copy',
    description: 'The kicker above the homepage logo wall, plus the film and the statistics — neither of which the homepage shows any more.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" value={value.paragraph1} onChange={(paragraph1) => onChange({ paragraph1 })} />
        </Section>
        <Section title="Film" description="Plays on click. Leave the link empty to show the still on its own.">
          <ImageUploader label="Poster still" value={value.videoPoster} onChange={(videoPoster) => onChange({ videoPoster })} folder="site/about" />
          <TextField label="Video link" value={value.videoUrl} onChange={(videoUrl) => onChange({ videoUrl })} />
          <p className="-mt-3 text-[11px] text-bone-3">A YouTube or Vimeo link, or a direct link to an .mp4 file.</p>
        </Section>
        <Section title="Stats" description="Not shown on the homepage any more — the partners section is the logo wall alone. Kept here and still used elsewhere.">
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
    key: 'featured_home',
    label: 'Featured property (homepage panel)',
    description: 'The single property lifted out of the list into a bordered panel. Clear the heading to hide the panel entirely.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">
            Wrap the property name in *asterisks* to set it in saffron, e.g. &quot;Grow Your Business at *Centro Plaza*&quot;. A line break puts it on its own line.
          </p>
          <TextField label="Subheading" value={value.subheading} onChange={(subheading) => onChange({ subheading })} />
          <p className="-mt-3 text-[11px] text-bone-3">Asterisks here set the wrapped words in blue instead.</p>
          <TextAreaField label="Paragraph" rows={3} value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section title="Buttons">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Primary label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
            <TextField label="Primary link" value={value.ctaHref} onChange={(ctaHref) => onChange({ ctaHref })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Secondary label" value={value.secondaryLabel} onChange={(secondaryLabel) => onChange({ secondaryLabel })} />
            <TextField label="Secondary link" value={value.secondaryHref} onChange={(secondaryHref) => onChange({ secondaryHref })} />
          </div>
          <p className="-mt-3 text-[11px] text-bone-3">Leave a label empty to hide that button.</p>
        </Section>
        <Section title="Photograph">
          <ImageUploader value={value.image} onChange={(image) => onChange({ image })} folder="site/featured" />
          <TextField label="Alt text" value={value.imageAlt} onChange={(imageAlt) => onChange({ imageAlt })} />
          <p className="-mt-3 text-[11px] text-bone-3">Describe the photo for screen readers. Leave empty if it adds nothing the copy does not already say.</p>
        </Section>
      </>
    ),
  },
  {
    key: 'services_home',
    label: 'More ways to build (homepage strip)',
    description: 'The four photographic cards — interiors, collaborations, franchise, invest.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
          <TextAreaField label="Paragraph" rows={3} value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section title="Cards" description="A photograph and a name each. Cards with no photograph show the Prime mark until one is uploaded.">
          <RepeatableList
            items={value.items}
            onChange={(items) => onChange({ items })}
            makeItem={() => ({ title: '', image: '', href: '' })}
            addLabel="Add card"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader value={item.image} onChange={(image) => set({ ...item, image })} folder="site/services" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
                  <TextField label="Link" value={item.href} onChange={(href) => set({ ...item, href })} />
                </div>
                <p className="-mt-3 text-[11px] text-bone-3">Leave the link empty and the card is shown but not clickable.</p>
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
    label: 'Explore our properties (homepage mosaic)',
    description: 'The four-photo mosaic — photos and names come from the Properties list, in their sort order.',
    Editor: ({ value, onChange }) => (
      <Section title="Copy">
        <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
        <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
        <TextAreaField label="Paragraph" rows={4} value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        <TextField label="Button label" value={value.ctaLabel} onChange={(ctaLabel) => onChange({ ctaLabel })} />
        <p className="-mt-3 text-[11px] text-bone-3">The button always goes to the properties page.</p>
      </Section>
    ),
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    description: 'Client quotes on the homepage.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
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
    label: 'Latest updates (homepage)',
    description:
      'One stream mixing your journal posts with social posts you add here. Journal posts come from the News list automatically — you only add the social ones.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Heading" value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section
          title="Social posts"
          description="Add a post from Instagram, Facebook or anywhere else. Cards are ordered newest first across both journal and social, so the date is what decides where a post lands — not the order of this list. Six show on the homepage."
        >
          <RepeatableList
            items={value.items}
            onChange={(items) => onChange({ items })}
            makeItem={() => ({ platform: 'instagram', image: '', title: '', caption: '', href: '', postedAt: '' })}
            addLabel="Add post"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader value={item.image} onChange={(image) => set({ ...item, image })} folder="site/updates" />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Platform"
                    value={item.platform}
                    onChange={(platform) => set({ ...item, platform })}
                    options={PLATFORM_KEYS}
                  />
                  <TextField
                    label="Date posted"
                    type="date"
                    value={item.postedAt}
                    onChange={(postedAt) => set({ ...item, postedAt })}
                  />
                </div>
                <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
                <TextAreaField label="Caption" rows={2} value={item.caption} onChange={(caption) => set({ ...item, caption })} />
                <TextField label="Link to the post" value={item.href} onChange={(href) => set({ ...item, href })} />
                <p className="-mt-3 text-[11px] text-bone-3">
                  Paste the post&apos;s own URL — the card opens it in a new tab. Leave the date empty and the post falls to the end of the stream.
                </p>
              </div>
            )}
          />
        </Section>
      </>
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
    key: 'interiors_page',
    label: 'Interiors catalog',
    description: 'The /enterprise/interiors tier grid and every typology detail page — one entry per finish option.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Introduction">
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" rows={3} value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
        </Section>
        <Section title="Finish options" description="Use a short, unique URL slug for each option.">
          <RepeatableList
            items={value.options ?? []}
            onChange={(options) => onChange({ options })}
            makeItem={() => ({
              slug: '', tier: TIERS[0], name: '', category: '', pricePerSqft: '',
              thumbnail: '', beforeImage: '', heroImage: '', images: [], description: '', videoUrl: '', specs: [],
            })}
            addLabel="Add option"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                  <TextField label="URL slug" value={item.slug} onChange={(slug) => set({ ...item, slug })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <SelectField label="Tier" value={item.tier} onChange={(tier) => set({ ...item, tier })} options={TIERS} />
                  <TextField label="Category" value={item.category} onChange={(category) => set({ ...item, category })} />
                  <TextField label="Price per sqft" value={item.pricePerSqft} onChange={(pricePerSqft) => set({ ...item, pricePerSqft })} />
                </div>
                <ImageUploader label="Thumbnail (grid card)" value={item.thumbnail} onChange={(thumbnail) => set({ ...item, thumbnail })} folder="site/interiors" />
                <ImageUploader label="Before image (comparison)" value={item.beforeImage} onChange={(beforeImage) => set({ ...item, beforeImage })} folder="site/interiors" />
                <ImageUploader label="After image (detail hero)" value={item.heroImage} onChange={(heroImage) => set({ ...item, heroImage })} folder="site/interiors" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Image set</span>
                  <div className="mt-2">
                    <RepeatableList
                      items={item.images ?? []}
                      onChange={(images) => set({ ...item, images })}
                      makeItem={() => ''}
                      addLabel="Add image"
                      renderItem={(url, setUrl) => <ImageUploader value={url} onChange={setUrl} folder="site/interiors" />}
                    />
                  </div>
                </div>
                <TextAreaField label="Description" rows={4} value={item.description} onChange={(description) => set({ ...item, description })} />
                <TextField label="YouTube link" value={item.videoUrl} onChange={(videoUrl) => set({ ...item, videoUrl })} />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Specifications</span>
                  <div className="mt-2">
                    <RepeatableList
                      items={item.specs ?? []}
                      onChange={(specs) => set({ ...item, specs })}
                      makeItem={() => ({ label: '', value: '' })}
                      addLabel="Add spec"
                      renderItem={(spec, setSpec) => (
                        <div className="grid grid-cols-2 gap-3">
                          <TextField label="Label" value={spec.label} onChange={(label) => setSpec({ ...spec, label })} />
                          <TextField label="Value" value={spec.value} onChange={(value) => setSpec({ ...spec, value })} />
                        </div>
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'interiors_gallery',
    label: 'Interiors — finished spaces',
    description: 'Real units finished with the catalog above. Shown at /enterprise/interiors/gallery, filterable by property and tier.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Copy">
          <TextField label="Heading" value={value.heading} onChange={(heading) => onChange({ heading })} />
        </Section>
        <Section title="Entries" description="Option slugs are comma-separated, matching the slugs set in the Interiors catalog.">
          <RepeatableList
            items={value.entries ?? []}
            onChange={(entries) => onChange({ entries })}
            makeItem={() => ({ slug: '', propertySlug: '', unitLabel: '', tier: TIERS[0], optionSlugs: '', photos: [] })}
            addLabel="Add entry"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="URL slug" value={item.slug} onChange={(slug) => set({ ...item, slug })} />
                  <SelectField label="Tier" value={item.tier} onChange={(tier) => set({ ...item, tier })} options={TIERS} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Property slug" value={item.propertySlug} onChange={(propertySlug) => set({ ...item, propertySlug })} />
                  <TextField label="Unit label" value={item.unitLabel} onChange={(unitLabel) => set({ ...item, unitLabel })} />
                </div>
                <TextField label="Option slugs used" value={item.optionSlugs} onChange={(optionSlugs) => set({ ...item, optionSlugs })} />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Photos</span>
                  <div className="mt-2">
                    <RepeatableList
                      items={item.photos ?? []}
                      onChange={(photos) => set({ ...item, photos })}
                      makeItem={() => ''}
                      addLabel="Add photo"
                      renderItem={(url, setUrl) => <ImageUploader value={url} onChange={setUrl} folder="site/interiors-gallery" />}
                    />
                  </div>
                </div>
              </div>
            )}
          />
        </Section>
      </>
    ),
  },
  {
    key: 'franchise_page',
    label: 'Franchise page',
    description: 'The /enterprise/franchise page — existing franchisees and the open call for new operators.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
          <ImageUploader label="Banner image" value={value.heroImage} onChange={(heroImage) => onChange({ heroImage })} folder="site/franchise" />
        </Section>
        <Section title="Existing franchisees" description="Only list a brand once it has actually signed — this shows publicly as fact.">
          <RepeatableList
            items={value.existingFranchisees ?? []}
            onChange={(existingFranchisees) => onChange({ existingFranchisees })}
            makeItem={() => ({ brandName: '', logo: '', image: '', propertySlug: '', blurb: '' })}
            addLabel="Add franchisee"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader label="Storefront photo" value={item.image} onChange={(image) => set({ ...item, image })} folder="site/franchise" />
                <ImageUploader label="Logo" value={item.logo} onChange={(logo) => set({ ...item, logo })} folder="site/franchise" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Brand name" value={item.brandName} onChange={(brandName) => set({ ...item, brandName })} />
                  <TextField label="Property slug" value={item.propertySlug} onChange={(propertySlug) => set({ ...item, propertySlug })} />
                </div>
                <TextAreaField label="Blurb" value={item.blurb} onChange={(blurb) => set({ ...item, blurb })} />
              </div>
            )}
          />
        </Section>
        <Section title="Open to new franchises">
          <TextAreaField label="Paragraph" value={value.openToNew?.paragraph} onChange={(paragraph) => onChange({ openToNew: { ...value.openToNew, paragraph } })} />
          <TextField label="Footprint range" value={value.openToNew?.footprintRange} onChange={(footprintRange) => onChange({ openToNew: { ...value.openToNew, footprintRange } })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Why partner with us</span>
            <div className="mt-2">
              <RepeatableList
                items={value.openToNew?.whyPartner ?? []}
                onChange={(whyPartner) => onChange({ openToNew: { ...value.openToNew, whyPartner } })}
                makeItem={() => ''}
                addLabel="Add point"
                renderItem={(item, set) => <TextField value={item} onChange={set} />}
              />
            </div>
          </div>
        </Section>
      </>
    ),
  },
  {
    key: 'collab_page',
    label: 'Collab page',
    description: 'The /enterprise/collab page — joint-venture partnerships.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
          <ImageUploader label="Banner image" value={value.heroImage} onChange={(heroImage) => onChange({ heroImage })} folder="site/collab" />
        </Section>
        <Section title="Existing partnerships" description="Only list a partnership once it is actually in place — this shows publicly as fact.">
          <RepeatableList
            items={value.existingPartnerships ?? []}
            onChange={(existingPartnerships) => onChange({ existingPartnerships })}
            makeItem={() => ({ partnerName: '', concept: '', image: '', propertySlug: '', summary: '' })}
            addLabel="Add partnership"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader label="Photo" value={item.image} onChange={(image) => set({ ...item, image })} folder="site/collab" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Partner name" value={item.partnerName} onChange={(partnerName) => set({ ...item, partnerName })} />
                  <TextField label="Concept" value={item.concept} onChange={(concept) => set({ ...item, concept })} />
                </div>
                <TextField label="Property slug" value={item.propertySlug} onChange={(propertySlug) => set({ ...item, propertySlug })} />
                <TextAreaField label="Summary" value={item.summary} onChange={(summary) => set({ ...item, summary })} />
              </div>
            )}
          />
        </Section>
        <Section title="How the partnership model works">
          <TextAreaField label="What we contribute" value={value.howItWorks?.contributesUs} onChange={(contributesUs) => onChange({ howItWorks: { ...value.howItWorks, contributesUs } })} />
          <TextAreaField label="What the partner contributes" value={value.howItWorks?.contributesPartner} onChange={(contributesPartner) => onChange({ howItWorks: { ...value.howItWorks, contributesPartner } })} />
          <TextAreaField label="Equity & decision-making" value={value.howItWorks?.equitySplit} onChange={(equitySplit) => onChange({ howItWorks: { ...value.howItWorks, equitySplit } })} />
          <TextAreaField label="Ideal partner profile" value={value.howItWorks?.idealPartner} onChange={(idealPartner) => onChange({ howItWorks: { ...value.howItWorks, idealPartner } })} />
        </Section>
      </>
    ),
  },
  {
    key: 'invest_page',
    label: 'Invest page',
    description: 'The /enterprise/invest page — the two investment tracks.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Hero">
          <TextField label="Eyebrow" value={value.heroEyebrow} onChange={(heroEyebrow) => onChange({ heroEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
          <ImageUploader label="Banner image" value={value.heroImage} onChange={(heroImage) => onChange({ heroImage })} folder="site/invest" />
        </Section>
        <Section title="Planning-phase investment">
          <TextAreaField label="Description" value={value.planningPhase?.description} onChange={(description) => onChange({ planningPhase: { ...value.planningPhase, description } })} />
          <TextField label="Entry cost profile" value={value.planningPhase?.entryCost} onChange={(entryCost) => onChange({ planningPhase: { ...value.planningPhase, entryCost } })} />
          <TextField label="Timeline" value={value.planningPhase?.timeline} onChange={(timeline) => onChange({ planningPhase: { ...value.planningPhase, timeline } })} />
          <TextField label="Risk profile" value={value.planningPhase?.riskProfile} onChange={(riskProfile) => onChange({ planningPhase: { ...value.planningPhase, riskProfile } })} />
        </Section>
        <Section title="Property CAP / NNN investment">
          <TextAreaField label="Description" value={value.propertyCap?.description} onChange={(description) => onChange({ propertyCap: { ...value.propertyCap, description } })} />
          <TextField label="Typical cap rate range" value={value.propertyCap?.capRateRange} onChange={(capRateRange) => onChange({ propertyCap: { ...value.propertyCap, capRateRange } })} />
          <TextField label="Lease structure" value={value.propertyCap?.leaseStructure} onChange={(leaseStructure) => onChange({ propertyCap: { ...value.propertyCap, leaseStructure } })} />
          <TextField label="Passive-income note" value={value.propertyCap?.passiveIncomeNote} onChange={(passiveIncomeNote) => onChange({ propertyCap: { ...value.propertyCap, passiveIncomeNote } })} />
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
