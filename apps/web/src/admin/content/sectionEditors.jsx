import { Section, TextField, TextAreaField, SelectField, CheckboxField } from '../components/Field'
import ImageUploader from '../components/ImageUploader'
import RepeatableList from '../components/RepeatableList'
import { PLATFORM_KEYS } from '../../lib/platforms'

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
      <>
        <Section title="Copy">
          <TextAreaField label="Heading" rows={2} value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">{emphasisHint}</p>
        </Section>
        <Section title="Card labels">
          <TextField label="Units chip label" value={value.unitsLabel} onChange={(unitsLabel) => onChange({ unitsLabel })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label={'"View property" button'} value={value.viewLabel} onChange={(viewLabel) => onChange({ viewLabel })} />
            <TextField label={'"Download brochure" button'} value={value.brochureLabel} onChange={(brochureLabel) => onChange({ brochureLabel })} />
          </div>
        </Section>
      </>
    ),
  },
  {
    key: 'brochure_modal',
    label: 'Brochure request modal',
    description: 'The dialog that opens from a property card’s "Download brochure" button.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Form">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} />
          <TextField label="Heading" value={value.heading} onChange={(heading) => onChange({ heading })} />
          <p className="-mt-3 text-[11px] text-bone-3">Use <code>{'{name}'}</code> where the property's name should appear, e.g. "Receive {'{name}'} by email".</p>
          <TextAreaField label="Paragraph" value={value.paragraph} onChange={(paragraph) => onChange({ paragraph })} />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Name placeholder" value={value.namePlaceholder} onChange={(namePlaceholder) => onChange({ namePlaceholder })} />
            <TextField label="Email placeholder" value={value.emailPlaceholder} onChange={(emailPlaceholder) => onChange({ emailPlaceholder })} />
            <TextField label="Phone placeholder" value={value.phonePlaceholder} onChange={(phonePlaceholder) => onChange({ phonePlaceholder })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Submit button" value={value.submitLabel} onChange={(submitLabel) => onChange({ submitLabel })} />
            <TextField label="Submit button (sending)" value={value.sendingLabel} onChange={(sendingLabel) => onChange({ sendingLabel })} />
          </div>
          <TextAreaField label="Error message" rows={2} value={value.errorMessage} onChange={(errorMessage) => onChange({ errorMessage })} />
        </Section>
        <Section title="Success state">
          <TextField label="Heading" value={value.successHeading} onChange={(successHeading) => onChange({ successHeading })} />
          <TextAreaField label="Body" rows={2} value={value.successBody} onChange={(successBody) => onChange({ successBody })} />
          <p className="-mt-3 text-[11px] text-bone-3">Use <code>{'{name}'}</code> for the property's name here too.</p>
          <TextField label="Done button" value={value.doneLabel} onChange={(doneLabel) => onChange({ doneLabel })} />
        </Section>
        <Section title="Received state" description="Shown when the request was logged but no brochure was emailed — email not set up, no brochure on file, or the send failed.">
          <TextField label="Heading" value={value.receivedHeading} onChange={(receivedHeading) => onChange({ receivedHeading })} />
          <TextAreaField label="Body" rows={2} value={value.receivedBody} onChange={(receivedBody) => onChange({ receivedBody })} />
        </Section>
      </>
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
          <TextField
            label="Homepage teaser link label"
            value={value.exploreLinkLabel}
            onChange={(exploreLinkLabel) => onChange({ exploreLinkLabel })}
          />
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
          <TextField label="Carousel hint label" value={value.scrollLabel} onChange={(scrollLabel) => onChange({ scrollLabel })} />
          <TextAreaField
            label="Follow strip text"
            rows={2}
            value={value.followText}
            onChange={(followText) => onChange({ followText })}
          />
          <p className="-mt-3 text-[11px] text-bone-3">Sits next to the social links at the bottom of the section — separate from the paragraph above.</p>
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
      <>
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
        <Section title="Enquire button">
          <TextField label="Button label" value={value.enquireLabel} onChange={(enquireLabel) => onChange({ enquireLabel })} />
        </Section>
        <Section title="WhatsApp" description="Shown when the footer's social links include a WhatsApp entry.">
          <TextAreaField
            label="Prefilled join message"
            rows={2}
            value={value.whatsappMessage}
            onChange={(whatsappMessage) => onChange({ whatsappMessage })}
          />
          <TextField
            label="Dialog heading"
            value={value.whatsappDialogHeading}
            onChange={(whatsappDialogHeading) => onChange({ whatsappDialogHeading })}
          />
          <TextAreaField
            label="Dialog paragraph"
            rows={3}
            value={value.whatsappDialogParagraph}
            onChange={(whatsappDialogParagraph) => onChange({ whatsappDialogParagraph })}
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label={'"Join the updates group" button'}
              value={value.whatsappJoinLabel}
              onChange={(whatsappJoinLabel) => onChange({ whatsappJoinLabel })}
            />
            <TextField
              label={'"Chat with our team" button'}
              value={value.whatsappChatLabel}
              onChange={(whatsappChatLabel) => onChange({ whatsappChatLabel })}
            />
          </div>
        </Section>
      </>
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
          <TextField label="Column heading" value={value.quickLinksHeading} onChange={(quickLinksHeading) => onChange({ quickLinksHeading })} />
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
        <Section title="Portfolio column">
          <TextField label="Column heading" value={value.portfolioHeading} onChange={(portfolioHeading) => onChange({ portfolioHeading })} />
          <TextField label={'"All properties" link'} value={value.allPropertiesLabel} onChange={(allPropertiesLabel) => onChange({ allPropertiesLabel })} />
          <p className="-mt-3 text-[11px] text-bone-3">The properties listed here come from the Properties list, in sort order.</p>
        </Section>
        <Section title="Social links">
          <TextField label="Column heading" value={value.socialHeading} onChange={(socialHeading) => onChange({ socialHeading })} />
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
    key: 'texas_map',
    label: 'Service area map',
    description: 'City coordinates for the footer’s Texas map. A property whose city isn’t listed here gets no marker.',
    Editor: ({ value, onChange }) => (
      <Section title="Cities" description={"Name must match the city in a property's address (e.g. \"Cedar Park\" for an address ending …, Cedar Park, TX …)."}>
        <RepeatableList
          items={value.cities}
          onChange={(cities) => onChange({ cities })}
          makeItem={() => ({ name: '', lat: '', lon: '' })}
          addLabel="Add city"
          renderItem={(item, set) => (
            <div className="grid grid-cols-3 gap-3">
              <TextField label="City" value={item.name} onChange={(name) => set({ ...item, name })} />
              <TextField label="Latitude" type="number" value={item.lat} onChange={(lat) => set({ ...item, lat })} />
              <TextField label="Longitude" type="number" value={item.lon} onChange={(lon) => set({ ...item, lon })} />
            </div>
          )}
        />
      </Section>
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
          <TextField label="Subheading" value={value.heroSubheading} onChange={(heroSubheading) => onChange({ heroSubheading })} />
          <p className="-mt-3 text-[11px] text-bone-3">The smaller line under the eyebrow (e.g. "Start a Conversation").</p>
        </Section>
        <Section title="Contact details">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Email" value={value.email} onChange={(email) => onChange({ email })} />
            <TextField label="Phone" value={value.phone} onChange={(phone) => onChange({ phone })} />
          </div>
          <TextField label="Location" value={value.location} onChange={(location) => onChange({ location })} />
        </Section>
        <Section title="Social links" description="Shown as a row of icons on the contact page.">
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
        <Section title="Form panel">
          <TextField label="Eyebrow" value={value.formEyebrow} onChange={(formEyebrow) => onChange({ formEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.formHeading} onChange={(formHeading) => onChange({ formHeading })} />
          <TextAreaField label="Paragraph" value={value.formParagraph} onChange={(formParagraph) => onChange({ formParagraph })} />
        </Section>
        <Section title="Texas coverage band">
          <TextField label="Eyebrow" value={value.mapEyebrow} onChange={(mapEyebrow) => onChange({ mapEyebrow })} />
          <TextAreaField label="Heading" rows={2} value={value.mapHeading} onChange={(mapHeading) => onChange({ mapHeading })} />
          <TextAreaField label="Paragraph" value={value.mapParagraph} onChange={(mapParagraph) => onChange({ mapParagraph })} />
          <TextField label="Map search query" value={value.mapQuery} onChange={(mapQuery) => onChange({ mapQuery })} />
          <p className="-mt-3 text-[11px] text-bone-3">What the embedded Google Map searches for, e.g. "Texas, USA" or a specific city.</p>
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
          <TextAreaField
            label="Subheading"
            rows={2}
            value={value.capabilitiesSubheading}
            onChange={(capabilitiesSubheading) => onChange({ capabilitiesSubheading })}
          />
          <TextField label="Sidebar label" value={value.practiceLabel} onChange={(practiceLabel) => onChange({ practiceLabel })} />
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
  {
    key: 'property_detail_page',
    label: 'Property page (shared labels)',
    description: 'Section labels and the closing call-to-action shared by every property\'s detail page. Per-property content (name, photos, floor plans, etc.) is edited from Properties.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Not found">
          <TextField label="Heading" value={value.notFoundHeading} onChange={(notFoundHeading) => onChange({ notFoundHeading })} />
          <TextField label="Back link" value={value.notFoundBackLabel} onChange={(notFoundBackLabel) => onChange({ notFoundBackLabel })} />
        </Section>
        <Section title="Section labels">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Resources" value={value.resourcesLabel} onChange={(resourcesLabel) => onChange({ resourcesLabel })} />
            <TextField label={'Overview "Enquire" pill'} value={value.overviewEnquireLabel} onChange={(overviewEnquireLabel) => onChange({ overviewEnquireLabel })} />
          </div>
          <TextField label="Highlights eyebrow" value={value.highlightsEyebrow} onChange={(highlightsEyebrow) => onChange({ highlightsEyebrow })} />
          <TextField label="Established sites" value={value.establishedSitesLabel} onChange={(establishedSitesLabel) => onChange({ establishedSitesLabel })} />
          <TextField label="Ext. facade" value={value.extFacadeLabel} onChange={(extFacadeLabel) => onChange({ extFacadeLabel })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Neighborhoods eyebrow" value={value.neighborhoodsLabel} onChange={(neighborhoodsLabel) => onChange({ neighborhoodsLabel })} />
            <TextField label="Neighborhoods heading" value={value.neighborhoodsHeading} onChange={(neighborhoodsHeading) => onChange({ neighborhoodsHeading })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Videos eyebrow" value={value.videosLabel} onChange={(videosLabel) => onChange({ videosLabel })} />
            <TextField label="Videos heading" value={value.videosHeading} onChange={(videosHeading) => onChange({ videosHeading })} />
          </div>
        </Section>
        <Section title="Closing call to action">
          <TextField label="Eyebrow" value={value.closingLabel} onChange={(closingLabel) => onChange({ closingLabel })} />
          <TextField label="Heading" value={value.closingHeading} onChange={(closingHeading) => onChange({ closingHeading })} />
          <p className="-mt-3 text-[11px] text-bone-3">Use <code>{'{name}'}</code> for the property's name, e.g. "Interested in {'{name}'}?".</p>
          <TextAreaField label="Paragraph" rows={2} value={value.closingParagraph} onChange={(closingParagraph) => onChange({ closingParagraph })} />
          <p className="-mt-3 text-[11px] text-bone-3">Use <code>{'{soldPct}'}</code> for the percentage currently reserved.</p>
          <TextField label="Button label" value={value.closingCtaLabel} onChange={(closingCtaLabel) => onChange({ closingCtaLabel })} />
        </Section>
      </>
    ),
  },
  {
    key: 'property_info_page',
    label: 'Property info page (shared labels)',
    description: 'Shared labels and legal text on the /properties/:slug/info template.',
    Editor: ({ value, onChange }) => (
      <>
        <Section title="Section labels">
          <div className="grid grid-cols-2 gap-4">
            <TextField label={'"Listings" eyebrow'} value={value.listingsLabel} onChange={(listingsLabel) => onChange({ listingsLabel })} />
            <TextField label="Listings heading" value={value.elsewhereHeading} onChange={(elsewhereHeading) => onChange({ elsewhereHeading })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label={'"Enquiries" eyebrow'} value={value.enquiriesLabel} onChange={(enquiriesLabel) => onChange({ enquiriesLabel })} />
            <TextField label="Enquiries heading" value={value.talkToTeamHeading} onChange={(talkToTeamHeading) => onChange({ talkToTeamHeading })} />
          </div>
          <TextField label="Email link label" value={value.emailLinkLabel} onChange={(emailLinkLabel) => onChange({ emailLinkLabel })} />
        </Section>
        <Section title="Legal">
          <TextAreaField
            label="Disclaimer"
            rows={4}
            value={value.legalDisclaimer}
            onChange={(legalDisclaimer) => onChange({ legalDisclaimer })}
          />
        </Section>
      </>
    ),
  },
]
