"""Generate branded, searchable PDFs from maintained content and the privacy HTML."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import shutil
import json
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from fontTools.ttLib import TTFont as Font
from fontTools.varLib.instancer import instantiateVariableFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'downloads'; OUT.mkdir(exist_ok=True)
TEMP=ROOT/'.preview'; TEMP.mkdir(exist_ok=True)
config=json.loads((ROOT/'site.config.json').read_text(encoding='utf-8'))
for family,weight in [('Manrope',650),('SourceSans3',400)]:
    src=ROOT/f'images/TruSelv_Brand_Kit/03_Typography/Fonts/{family}-Variable.ttf'
    target=TEMP/f'{family}-print.ttf'
    if not target.exists(): instantiateVariableFont(Font(src),{'wght':weight},inplace=False).save(target)
    pdfmetrics.registerFont(TTFont(family,str(target)))
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleTru',fontName='Manrope',fontSize=29,leading=36,textColor=HexColor('#14283b'),spaceAfter=18))
styles.add(ParagraphStyle(name='SubTru',fontName='SourceSans3',fontSize=13,leading=19,textColor=HexColor('#49606f'),spaceAfter=26))
styles.add(ParagraphStyle(name='HeadTru',fontName='Manrope',fontSize=15,leading=20,textColor=HexColor('#14283b'),spaceBefore=18,spaceAfter=9,keepWithNext=True))
styles.add(ParagraphStyle(name='BodyTru',fontName='SourceSans3',fontSize=11,leading=16,textColor=HexColor('#14283b'),spaceAfter=10))
styles.add(ParagraphStyle(name='SmallTru',fontName='SourceSans3',fontSize=9,leading=13,textColor=HexColor('#49606f'),spaceAfter=10))

def decoration(canvas,doc):
    canvas.saveState(); w,h=doc.pagesize
    canvas.setFillColor(HexColor('#f7f3ea')); canvas.rect(0,h-78,w,78,fill=1,stroke=0)
    logo=ROOT/'images/TruSelv_Brand_Kit/01_Logos/PNG/Primary/truselv-logo-horizontal-primary-2400.png'
    canvas.drawImage(str(logo),44,h-62,width=106,height=36,mask='auto',preserveAspectRatio=True)
    canvas.setFont('SourceSans3',9); canvas.setFillColor(HexColor('#49606f')); canvas.drawRightString(w-44,h-46,'Human-centred digital healthcare')
    canvas.setStrokeColor(HexColor('#d9dedb')); canvas.line(44,43,w-44,43)
    canvas.setFont('SourceSans3',8); canvas.drawString(44,28,'TruSelv  |  15 September 2026  |  v1.0'); canvas.drawRightString(w-44,28,f'truselv.co.uk  /  {doc.page}')
    canvas.restoreState()

def pdf(file,title,intro,sections,closing=True):
    compact=file in ('cancellation-form.pdf','truselv-company-overview.pdf')
    body_style=ParagraphStyle(name='CompactBody',parent=styles['BodyTru'],fontSize=10,leading=13,spaceAfter=7) if compact else styles['BodyTru']
    head_style=ParagraphStyle(name='CompactHead',parent=styles['HeadTru'],fontSize=13,leading=17,spaceBefore=12,spaceAfter=6) if compact else styles['HeadTru']
    sub_style=ParagraphStyle(name='CompactSub',parent=styles['SubTru'],fontSize=11,leading=15,spaceAfter=15) if compact else styles['SubTru']
    story=[Paragraph(escape(title),styles['TitleTru']),Paragraph(escape(intro),sub_style)]
    for heading,paragraphs in sections:
        story.append(Paragraph(escape(heading),head_style))
        for paragraph in paragraphs:
            story.append(Paragraph(paragraph,body_style))
    if closing:
        story += [Spacer(1,15),HRFlowable(width='100%',thickness=1,color=HexColor('#10afa3')),Spacer(1,12),Paragraph('A useful next step',styles['HeadTru']),Paragraph('Discuss your setting with TruSelv: <link href="mailto:support@truselv.co.uk" color="#08786f">support@truselv.co.uk</link><br/><link href="https://truselv.co.uk/book-demo.html" color="#08786f">truselv.co.uk/book-demo.html</link>',styles['BodyTru'])]
    doc=SimpleDocTemplate(str(OUT/file),pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=104,bottomMargin=65,title=title,author='TruSelv',subject=intro)
    doc.build(story,onFirstPage=decoration,onLaterPages=decoration)

pdf('bedbord-product-brief.pdf','Bedbord. A clearer, more personal bedside.','A product brief for hospitals, care homes and care teams exploring the move from handwritten bedside boards to a digital display.',[
 ('What Bedbord is',['Bedbord is a TruSelv product for bedside information and communication. It brings useful information and personal preferences into a clear digital view. The final hardware, software release and deployment configuration are agreed during discovery.']),
 ('Why change the board?',['Readability: a consistent digital layout avoids dependence on handwriting and marker condition.','Daily work: digital updates could reduce repeated erasing and rewriting. Measure avoidable board-maintenance time in your setting.','Knowing the person: make room for a preferred name, interests and what matters today, with suitable permission and privacy controls.','Consumables: consider less reliance on markers and labels alongside energy use, device life, cleaning and responsible disposal.']),
 ('What to confirm before a pilot',['1. Which information is useful, who can see it and who is responsible for updating it.','2. The records system, available interfaces and local approval for any integration. Automatic synchronisation is not assumed.','3. Display location, mounting, electrical requirements, connectivity and approved cleaning.','4. How staff identify stale or incorrect information, and the fallback when power or the network is unavailable.','5. Product-specific assurance evidence, local clinical safety and information-governance review.']),
 ('Keep safe care in view',['Bedbord supports communication; it does not replace approved clinical records, identity checks or professional judgement. Clinical decisions must follow your organisation’s procedures. The display still needs approved cleaning.']),
 ('Model the practical value',['Illustration: 24 beds × 100% occupancy × 5 minutes released each day × 365 days ÷ 60 = 730 hours a year. This is a calculation, not a measured TruSelv result. Released capacity is not automatically a cash saving.','Use your own assumptions at <link href="https://truselv.co.uk/roi-calculator.html" color="#08786f">truselv.co.uk/roi-calculator.html</link>. Include software, installation, integration, support, energy and replacement costs in your business case.']),
 ('Document status',['This is an introductory product brief, not a release-specific specification, medical-device classification, safety case or certificate. Pricing, interfaces and available features must be confirmed in the written proposal.'])])

pdf('tess-product-brief.pdf','TESS. More moments that matter.','Therapeutic Engagement and Support System — a welcoming tablet experience for communication, entertainment and shared engagement.',[
 ('What TESS brings together',['Activities for conversation and communication, AI chat, sign-based interaction, entertainment, games, reminiscence and radio. Available features depend on the app release, plan, connectivity and any required third-party accounts.','TESS is designed to support shared moments between residents, families and care teams. Let the person’s interests and preferences guide the activity.']),
 ('Different ways to take part',['Explore touchscreen, keyboard, mouse or stylus use with compatible accessories. Choose a comfortable interaction method and the right level of support. Not every activity or interaction method will suit every person.']),
 ('The tablet offer',[f'The advertised base offer is £{config["tessUnitPrice"]} for one tablet.',escape(config['bundleStatement']),escape(config['vatStatement']+' '+config['deliveryStatement'])]),
 ('Your own tablet',['The TESS app is intended for compatible iPad and Android tablets with a free download. Ask for current store availability, minimum operating-system requirements and available features. This website does not yet publish verified store listings.']),
 ('Before use in a care setting',['Confirm account permissions, shared-device arrangements, connectivity, hygiene instructions, charging and support. Trial activities with the person and offer a way to stop or change activity.','AI may be inaccurate. TESS does not replace clinical advice, an emergency system, a carer or a qualified interpreter. No claim is made that TESS treats, prevents or diagnoses a condition.']),
 ('Before you order',['An order enquiry is not a purchase, reservation or subscription. Confirm the legal seller, exact specification, full payable price, delivery, setup and support and cancellation terms before payment. Product photography is illustrative; it is not a contractual accessory list.'])])

pdf('pilot-planning-guide.pdf','A considered pilot. A useful decision.','A practical planning guide for teams exploring Bedbord or TESS. Adapt this framework to your organisation; it is not a fixed rollout timetable.',[
 ('1. Name the problem',['Write down the current workflow and the people affected. For Bedbord, consider readability, update responsibilities and board-maintenance time. For TESS, consider how activities are offered and the interaction methods people prefer.','Record the pilot lead, executive sponsor, care setting, proposed product/release and the question the pilot should answer.']),
 ('2. Bring the right people in',['Include clinical or care leadership, digital/IT, information governance, procurement, accessibility and infection prevention as appropriate. Involve representative users and family members where appropriate and with permission.','Agree who owns setup, training, updates, escalation, measurement and the decision to continue.']),
 ('3. Review before introducing the device',['Confirm the current intended use, hardware specification, relevant conformity and safety evidence, data flows, lawful basis, controller/processor roles and required agreements.','Agree local access, visibility and privacy settings; network and electrical requirements; mounting; approved cleaning; and downtime arrangements. If issues remain unresolved, record them and decide whether the pilot can safely proceed.']),
 ('4. Establish a baseline',['Choose a small set of measures before the pilot. For Bedbord: time spent on avoidable writing/erasing, whether displayed information is current and readable, and staff/patient feedback. For TESS: participation, preferences, ease of use and staff support required.','Record observation method, sample size, period, occupancy and known limitations. Do not collect identifiable care data unless authorised and necessary.']),
 ('5. Learn during the pilot',['Train the people using the product. Keep approved records and fallback processes available. Record support requests, interruptions, usability difficulties and unexpected burden.','Invite people to decline or stop participation where appropriate. Do not infer clinical benefit from enjoyment, uptake or a small uncontrolled pilot.']),
 ('6. Review and decide',['Compare baseline and pilot observations. Include negative feedback, new work, support costs and technical limitations. Distinguish staff capacity from cash-releasing savings.','Record the decision: stop, refine, extend or expand. Agree any outstanding assurance, costs, responsibilities and next review before wider rollout.']),
 ('Pilot worksheet',['Product / release: __________________________________________','Setting / lead: _____________________________________________','Problem / success measures: __________________________________','Baseline dates / pilot dates: __________________________________','Evidence still required: ______________________________________','Decision / responsible owner / date: ____________________________'])])

pdf('procurement-checklist.pdf','Good questions before deployment.','A discussion checklist for clinical, digital, information-governance and procurement teams assessing Bedbord or TESS.',[
 ('1. Intended use and specification',['Request the exact product, release, hardware model, intended-use statement, supported features and known limitations. Confirm whether any medical-device requirements apply. Do not infer classification from marketing.']),
 ('2. Clinical safety',['Determine whether DCB0129 and DCB0160 apply. Request the relevant clinical risk-management evidence, safety case, hazard log, responsible clinical-safety contact, residual risks and release/change process. Agree the care organisation’s responsibilities.']),
 ('3. Information governance',['Map what information is collected, displayed, stored and shared. Confirm controller/processor roles, lawful basis, special-category conditions where relevant, retention, hosting, subprocessors, transfers and subject-rights support. Complete any necessary DPIA and processing agreement.']),
 ('4. Security and service continuity',['Verify access controls, account lifecycle, authentication, encryption, auditability, update delivery and vulnerability management. Ask about testing, incident handling, backups and recovery where applicable.','For Bedbord, test stale-data behaviour, patient-change workflows and network/power failure. For TESS, confirm shared accounts, content permissions, reset and device loss.']),
 ('5. Hardware and accessibility',['Request applicable conformity declarations, electrical and mounting instructions, approved accessories, warranty and cleaning guidance. Confirm suitability for the intended location.','Test with representative users, local lighting and viewing distances, required languages and assistive/input methods. Record limitations and reasonable adjustments.']),
 ('6. Commercial and operational arrangements',['Confirm legal seller, full costs, taxes, delivery, licences, subscription activation/renewal, support hours, escalation, data return/deletion, exit, disposal and responsibility for maintenance. Agree success measures and acceptance criteria.']),
 ('Evidence log',['For each item record: document title; product and version covered; issue/review date; owner; reviewer; finding; expiry; and action. Missing evidence is an item to resolve, not proof of compliance.','This checklist is not certification. TruSelv’s marketing site does not publish verified ISO, DSPT, DTAC, conformity or clinical-safety evidence. Confirm availability for the exact product and use.']),
 ('References',['<link href="https://service-manual.nhs.uk/standards-and-technology/service-standard-points/16-make-your-service-clinically-safe" color="#08786f">NHS service manual: Make your service clinically safe</link>','<link href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/" color="#08786f">ICO: Data protection impact assessments</link>'])])

pdf('cancellation-form.pdf','Consumer cancellation form','Use this form only if you wish to cancel an eligible order. You can also send any clear statement of cancellation; this form is not compulsory.',[
 ('Send to TruSelv',['Email: support@truselv.co.uk','Correspondence: '+escape(config['address']),'Use the legal seller/contact details in your order confirmation where different. Please request the return address before posting goods; the correspondence address is not automatically a hardware returns depot.']),
 ('Your cancellation',['I/we hereby give notice that I/we cancel my/our contract of sale of the following goods / for the supply of the following service:','__________________________________________________________________','__________________________________________________________________','Order reference (if known): __________________________________________','Ordered on / received on: ___________________________________________','Name of consumer(s): ______________________________________________','Address of consumer(s): ____________________________________________','__________________________________________________________________','Email or telephone (optional, for the response): __________________________','Signature of consumer(s) (only if this form is notified on paper):','__________________________________________________________________','Date: ___________________________________________________________','Delete wording that does not apply.']),
 ('Keep a copy',['Retain a copy of your cancellation and evidence of sending. Eligible consumer goods cancellations normally require notice within 14 days after receipt and return within the following 14 days. Statutory rights for faulty goods are separate.','Read the current information at <link href="https://truselv.co.uk/returns.html" color="#08786f">truselv.co.uk/returns.html</link>. Do not include payment-card details or sensitive personal information.'])],closing=False)

class PrivacyParser(HTMLParser):
    def __init__(self): super().__init__(); self.inside=False; self.depth=0; self.current=None; self.buffer=[]; self.sections=[]; self.heading=''; self.paragraphs=[]
    def handle_starttag(self,tag,attrs):
        if tag=='article' and ('class','document-body') in attrs: self.inside=True
        if not self.inside:return
        if tag in ('h2','p','li'): self.current=tag; self.buffer=[]
        if tag=='br' and self.current: self.buffer.append(' ')
    def handle_data(self,data):
        if self.inside and self.current: self.buffer.append(data)
    def handle_endtag(self,tag):
        if not self.inside:return
        if tag==self.current:
            text=escape(''.join(self.buffer).strip())
            if tag=='h2':
                if self.heading:self.sections.append((self.heading,self.paragraphs))
                self.heading=text;self.paragraphs=[]
            else:self.paragraphs.append(text)
            self.current=None
        if tag=='article':
            if self.heading:self.sections.append((self.heading,self.paragraphs))
            self.inside=False

parser=PrivacyParser(); parser.feed((ROOT/'privacy.html').read_text(encoding='utf-8'))
pdf('website-privacy-notice.pdf','Website privacy notice','How information is handled when you browse truselv.co.uk, enquire about a product or ask for help. This PDF reproduces the website notice dated 15 September 2026.',parser.sections,closing=False)
pdf('truselv-company-overview.pdf','The person beyond the diagnosis.','TruSelv develops human-centred digital healthcare experiences through two flagship products: Bedbord and TESS.',[
 ('Our purpose',['Make important information clearer, support participation and help care environments feel more connected. Our focus is the person receiving care and the people who make that care possible.']),
 ('Bedbord',['A digital bedside information display that offers a more legible and personal alternative to handwritten boards. Deployment requires a scoped discussion of current features, integration and local safety and governance.']),
 ('TESS',['An approachable tablet experience for communication, games, entertainment, reminiscence and radio. The advertised tablet offer is £119; final sale details must be confirmed before purchase.']),
 ('Our founding team',['Eric Tweneboah — Founder and Chief Executive Officer.','Michaela Reynolds — Co-founder and Chief Operations Officer.','Osam-Frimpong Schandorf — Co-founder and Chief Technology Officer.']),
 ('Partnership approach',['Listen, scope, assess, pilot and review. A useful partnership begins with an agreed problem and measurable questions. Costs, timelines and support responsibilities are agreed in a written proposal.']),
 ('Evidence and claims',['This overview makes no claim of NHS approval, certification, completed clinical deployment or proven clinical outcomes. Product assurance and conformity evidence must be verified for the exact product, release and setting.'])])
# Replace historic downloadable claims at their existing URLs with current material.
shutil.copyfile(OUT/'bedbord-product-brief.pdf',ROOT/'documents/Bedbord-solution.pdf')
shutil.copyfile(OUT/'truselv-company-overview.pdf',ROOT/'documents/TruSelv-Investor-ready.pdf')
print('Generated 7 branded PDFs and updated 2 legacy document URLs.')
