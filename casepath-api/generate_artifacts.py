from __future__ import annotations

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from PIL import Image, ImageDraw, ImageFilter
import random

ROOT = Path(__file__).resolve().parent / 'artifacts'
ROOT.mkdir(parents=True, exist_ok=True)

RED = colors.HexColor('#c8102e')
INK = colors.HexColor('#1d1d1f')
MUTED = colors.HexColor('#666666')
LINE = colors.HexColor('#dedbd6')
LIGHT = colors.HexColor('#f5f4f2')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='DocTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=INK, spaceAfter=12))
styles.add(ParagraphStyle(name='DocSub', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=15, textColor=MUTED, spaceAfter=16))
styles.add(ParagraphStyle(name='H1x', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=INK, spaceBefore=10, spaceAfter=8))
styles.add(ParagraphStyle(name='H2x', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=INK, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name='Bodyx', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.5, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name='Smallx', parent=styles['BodyText'], fontName='Helvetica', fontSize=8, leading=11, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name='EmailHeader', parent=styles['BodyText'], fontName='Helvetica', fontSize=9, leading=13, textColor=INK, leftIndent=10, rightIndent=10, spaceAfter=3))


def footer(canvas, doc, label: str):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(LINE)
    canvas.line(24 * mm, 15 * mm, w - 24 * mm, 15 * mm)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(24 * mm, 9 * mm, f'Generated fictional document - CasePath demo - {label}')
    canvas.drawRightString(w - 24 * mm, 9 * mm, f'Page {doc.page}')
    canvas.restoreState()


def make_pdf(path: Path, title: str, subtitle: str, story, label: str):
    doc = SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=24*mm, rightMargin=24*mm,
        topMargin=22*mm, bottomMargin=22*mm, title=title, author='CasePath generated benchmark'
    )
    full = [Paragraph(title, styles['DocTitle']), Paragraph(subtitle, styles['DocSub'])] + story
    doc.build(full, onFirstPage=lambda c,d: footer(c,d,label), onLaterPages=lambda c,d: footer(c,d,label))


def lease():
    story=[]
    story += [Paragraph('1. Parties and premises', styles['H1x'])]
    data=[['Landlord','Rheinblick Immobilien AG, Clarastrasse 28, 4058 Basel'],['Tenant','Alex Morgan, Feldbergstrasse 114, 4057 Basel'],['Premises','3-room apartment, 3rd floor, Feldbergstrasse 114, 4057 Basel'],['Start date','1 February 2024'],['Monthly net rent','CHF 1,640'],['Advance ancillary costs','CHF 240']]
    t=Table(data,colWidths=[40*mm,115*mm]); t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,LINE),('BACKGROUND',(0,0),(0,-1),LIGHT),('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),9),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),7)])); story += [t, Spacer(1,10)]
    story += [Paragraph('The apartment is rented for residential use. The tenant may use the bedroom, living room, kitchen, bathroom, cellar compartment and shared laundry facilities in accordance with the building rules.', styles['Bodyx'])]
    story += [Paragraph('2. Condition and maintenance', styles['H1x'])]
    for p in [
        'The landlord makes the premises available in a condition fit for ordinary residential use and maintains the building systems and structure subject to mandatory law.',
        'The tenant carries out ordinary cleaning and minor maintenance. Structural repairs, moisture ingress, defective insulation and building-envelope defects are not minor maintenance.',
        'The tenant must report defects promptly and provide reasonable access for inspection and repair. The landlord must announce inspections and works in advance where practicable.'
    ]: story.append(Paragraph(p, styles['Bodyx']))
    story += [PageBreak(), Paragraph('3. Reporting defects', styles['H1x'])]
    for p in [
        'Defects should be reported in writing to the property management. The report should state when the problem began, where it occurs, whether it is recurring, and whether urgent health or safety concerns exist.',
        'Photographs, correspondence and earlier repair records may be supplied. A tenant is not expected to determine the technical cause of moisture or mould.',
        'The property management may arrange an inspection. The parties should preserve evidence until the cause is clarified.'
    ]: story.append(Paragraph(p, styles['Bodyx']))
    story += [Paragraph('4. Ventilation and heating', styles['H1x'])]
    story += [Paragraph('The tenant should ventilate and heat the apartment reasonably. No clause shifts liability for structural moisture, thermal bridges, failed seals or water ingress to the tenant. A ventilation allegation must be assessed against the building condition and actual use.', styles['Bodyx'])]
    story += [Paragraph('5. Access and inspections', styles['H1x'])]
    story += [Paragraph('The tenant permits reasonable access for maintenance and investigation after suitable notice. The management records the purpose and outcome of each visit.', styles['Bodyx'])]
    story += [PageBreak(), Paragraph('6. Rent, deposit and ancillary costs', styles['H1x'])]
    for p in [
        'Rent is payable monthly in advance. The security deposit is held in a blocked account in the tenant\'s name.',
        'Ancillary costs are billed annually. This agreement does not authorize unilateral deductions from the deposit for unproven defect causation.'
    ]: story.append(Paragraph(p, styles['Bodyx']))
    story += [Paragraph('7. Communications', styles['H1x'])]
    story += [Paragraph('Notices under this agreement may be sent by registered post or email where receipt can be shown. The parties should keep copies of communications and attachments.', styles['Bodyx'])]
    story += [Paragraph('8. Governing law', styles['H1x'])]
    story += [Paragraph('Swiss law applies. Mandatory provisions of Swiss tenancy law prevail over this agreement. Disputes may be submitted to the competent conciliation authority.', styles['Bodyx'])]
    story += [PageBreak(), Paragraph('9. Handover record - summary', styles['H1x'])]
    rows=[['Room','Recorded condition on 30 January 2024'],['Bedroom','Walls freshly painted; no visible moisture noted'],['Living room','Good condition'],['Windows','Double glazed; seals visually intact'],['Heating','Radiators tested'],['Bathroom','Ventilation fan operating']]
    t=Table(rows,colWidths=[45*mm,110*mm]); t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,LINE),('BACKGROUND',(0,0),(-1,0),LIGHT),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),9),('PADDING',(0,0),(-1,-1),7),('VALIGN',(0,0),(-1,-1),'TOP')])); story += [t]
    story += [Spacer(1,16), Paragraph('The handover record describes the visible condition at the start of the tenancy. It does not determine the cause of a later defect.', styles['Smallx'])]
    story += [PageBreak(), Paragraph('10. House rules - relevant excerpt', styles['H1x'])]
    for p in [
        'Rooms should be ventilated regularly. Furniture should not obstruct radiators or external-wall ventilation.',
        'The rules do not create a presumption that condensation or mould was caused by the tenant. Technical causation must be assessed from the facts.',
        'Damage or defects should be reported without delay.'
    ]: story.append(Paragraph(p, styles['Bodyx']))
    story += [PageBreak(), Paragraph('11. Signatures', styles['H1x'])]
    sign=Table([['Basel, 18 January 2024','Basel, 18 January 2024'],['Rheinblick Immobilien AG','Alex Morgan'],['________________________','________________________']],colWidths=[77*mm,77*mm]); sign.setStyle(TableStyle([('FONTNAME',(0,1),(-1,1),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)])); story.append(sign)
    make_pdf(ROOT/'lease-agreement.pdf','Residential Lease Agreement','Fictional generated source document - signed 18 January 2024',story,'lease-agreement.pdf')


def timeline():
    story=[Paragraph('Timeline supplied by the tenant', styles['H1x'])]
    rows=[['Date','Event','Source'],['12 Mar 2026','First small dark spots observed in bedroom corner.','Tenant note'],['20 Mar 2026','Customer message later recalls the first observation as 20 March.','Claim email'],['02 Apr 2026','Area cleaned; spots returned within approximately two weeks.','Tenant note'],['15 Jul 2026','Written notice sent to property management with one photograph.','Email attachment'],['18 Jul 2026','Management replies that ventilation is the likely cause.','Management email'],['27 Jul 2026','Mould visible again after cleaning.','Photo'],['01 Aug 2026','Claim submitted to legal-protection insurer.','Claim intake']]
    t=Table(rows,colWidths=[24*mm,93*mm,37*mm],repeatRows=1); t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,LINE),('BACKGROUND',(0,0),(-1,0),LIGHT),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),8.5),('LEADING',(0,0),(-1,-1),12),('PADDING',(0,0),(-1,-1),6),('VALIGN',(0,0),(-1,-1),'TOP')])); story += [t, Spacer(1,16)]
    story += [Paragraph('Open points', styles['H1x']), Paragraph('No independent inspection has been carried out. No measurements of wall temperature, humidity, air exchange or building-envelope condition are available. The tenant reports normal heating and no current health symptoms.', styles['Bodyx'])]
    story += [PageBreak(), Paragraph('Tenant observations', styles['H1x'])]
    for p in [
        'The affected area is the external corner behind, but not covered by, a wardrobe. The wardrobe stands approximately 15 cm from the wall.',
        'The bedroom radiator is used normally. The tenant reports airing the room twice daily for approximately five to ten minutes.',
        'The visible marks returned after surface cleaning. The tenant requests repair and, if needed, conciliation.'
    ]: story.append(Paragraph(p, styles['Bodyx']))
    story += [Paragraph('Data-quality note', styles['H1x']), Paragraph('The first-observation date is inconsistent: 12 March in this timeline and 20 March in the customer message. The discrepancy should be clarified, but it does not resolve the technical cause.', styles['Bodyx'])]
    make_pdf(ROOT/'defect-timeline.pdf','Defect Timeline','Fictional generated source document - prepared 30 July 2026',story,'defect-timeline.pdf')


def proof():
    story=[Paragraph('Delivery record', styles['H1x'])]
    rows=[['Message ID','<20260715.083200.alex.morgan@example.test>'],['Sent','15 July 2026, 08:32 CEST'],['Recipient','service@rheinblick-immobilien.example'],['Subject','Recurring mould in bedroom - Feldbergstrasse 114'],['Delivery status','Accepted by recipient mail server'],['Attachment','bedroom-corner-2026-07-15.jpg']]
    t=Table(rows,colWidths=[42*mm,112*mm]); t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,LINE),('BACKGROUND',(0,0),(0,-1),LIGHT),('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),9),('PADDING',(0,0),(-1,-1),7),('VALIGN',(0,0),(-1,-1),'TOP')])); story += [t, Spacer(1,14), Paragraph('This record supports that a written notification was sent and accepted by the recipient server. It does not establish that the defect was technically assessed or remedied.', styles['Bodyx'])]
    make_pdf(ROOT/'delivery-receipt.pdf','Email Delivery Receipt','Fictional generated source document',story,'delivery-receipt.pdf')


def create_photo():
    random.seed(17)
    w,h=1600,1100
    im=Image.new('RGB',(w,h),(220,219,211))
    d=ImageDraw.Draw(im)
    # wall gradients
    for y in range(h):
        shade=int(234 - 24*y/h)
        d.line((0,y,w,y),fill=(shade,shade-1,shade-7))
    # ceiling and corner
    d.polygon([(0,0),(w,0),(w,135),(0,85)],fill=(245,244,239))
    d.line((310,0,330,h),fill=(160,158,150),width=5)
    d.rectangle((0,880,w,h),fill=(176,153,128))
    d.line((0,880,w,880),fill=(126,113,99),width=6)
    # window glow right
    d.rectangle((1240,180,1599,760),fill=(230,238,239))
    d.rectangle((1252,195,1587,748),outline=(135,140,139),width=8)
    d.line((1418,200,1418,744),fill=(145,149,148),width=7)
    # mould cluster in upper left corner, diffuse
    overlay=Image.new('RGBA',(w,h),(0,0,0,0)); od=ImageDraw.Draw(overlay)
    centers=[(350,175),(405,240),(335,315),(455,360),(370,430),(500,475)]
    for cx,cy in centers:
        for _ in range(170):
            r=random.expovariate(1/5)+1
            ang=random.random()*6.283
            dist=random.expovariate(1/55)
            x=cx+int(dist*__import__('math').cos(ang)); y=cy+int(dist*__import__('math').sin(ang))
            col=random.choice([(38,52,38,90),(57,67,50,100),(22,28,25,75),(85,79,57,65)])
            od.ellipse((x-r,y-r,x+r,y+r),fill=col)
    overlay=overlay.filter(ImageFilter.GaussianBlur(1.4))
    im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
    # slight photographic noise
    pix=im.load()
    for _ in range(90000):
        x=random.randrange(w); y=random.randrange(h); c=pix[x,y]; n=random.choice([-3,-2,-1,0,0,0,1,2,3]); pix[x,y]=tuple(max(0,min(255,v+n)) for v in c)
    # timestamp strip, like phone photo metadata but not answer-leaking
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((48,1000,430,1060),radius=12,fill=(0,0,0,150))
    d.text((68,1018),'27 JUL 2026  |  BEDROOM',fill=(255,255,255))
    im.save(ROOT/'bedroom-mould-2026-07-27.jpg',quality=92,optimize=True)


def email_files():
    notification = """From: Alex Morgan <alex.morgan@example.test>\nTo: Service Team <service@rheinblick-immobilien.example>\nDate: Wed, 15 Jul 2026 08:32:00 +0200\nSubject: Recurring mould in bedroom - Feldbergstrasse 114\nMessage-ID: <20260715.083200.alex.morgan@example.test>\nMIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\nDear Service Team,\n\nThe dark mould in the external corner of the bedroom has returned after cleaning. I first noticed it in March. The radiator works and I air the room twice a day.\n\nPlease arrange an inspection and repair. I have attached a photograph. I can provide access on weekdays after 17:30.\n\nKind regards,\nAlex Morgan\n"""
    reply = """From: Property Management <service@rheinblick-immobilien.example>\nTo: Alex Morgan <alex.morgan@example.test>\nDate: Sat, 18 Jul 2026 10:14:00 +0200\nSubject: Re: Recurring mould in bedroom - Feldbergstrasse 114\nMessage-ID: <20260718.101400.service@rheinblick-immobilien.example>\nIn-Reply-To: <20260715.083200.alex.morgan@example.test>\nMIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\nDear Mr Morgan,\n\nThank you for your message. Based on the photograph, the marks appear consistent with insufficient ventilation. Please air the bedroom more often and avoid placing furniture close to the external wall.\n\nWe do not currently plan a technical inspection.\n\nKind regards,\nRheinblick Immobilien AG\nService Team\n"""
    later = """From: Sam Keller <sam.keller@example.test>\nTo: claims@protekta.example\nDate: Fri, 14 Aug 2026 09:46:00 +0200\nSubject: Condensation after window replacement\nMessage-ID: <20260814.094600.sam.keller@example.test>\nMIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\nHello,\n\nCondensation and dark spots have appeared around the bedroom window since the windows were replaced in May. The management says I do not air enough. The problem keeps returning even though I air every morning and evening. I sent the management an email last week. No technician has inspected the window or wall.\n\nWhat should I do next?\n\nRegards,\nSam Keller\n"""
    (ROOT/'notification-email.eml').write_text(notification,encoding='utf-8')
    (ROOT/'management-reply.eml').write_text(reply,encoding='utf-8')
    (ROOT/'later-claim-email.eml').write_text(later,encoding='utf-8')

lease(); timeline(); proof(); create_photo(); email_files()
print('generated', *[(p.name,p.stat().st_size) for p in sorted(ROOT.iterdir())], sep='\n')

def later_artifacts():
    # second fictional photo: condensation and spotting around a replaced window
    random.seed(41)
    w,h=1500,1050
    im=Image.new('RGB',(w,h),(221,220,214)); d=ImageDraw.Draw(im)
    for y in range(h):
        s=int(238-22*y/h); d.line((0,y,w,y),fill=(s,s,s-4))
    d.rectangle((430,140,1250,840),fill=(230,238,240),outline=(122,127,128),width=12)
    d.line((840,150,840,830),fill=(133,138,139),width=10)
    d.line((440,500,1240,500),fill=(133,138,139),width=9)
    # condensation beads
    for _ in range(400):
        x=random.randint(455,1230); y=random.randint(170,815); r=random.choice([1,1,2,2,3]);
        d.ellipse((x-r,y-r,x+r,y+r),fill=(190,205,208))
    # dark spotting around frame edges
    for _ in range(380):
        edge=random.choice(['l','r','t'])
        if edge=='l': x=random.gauss(420,25); y=random.uniform(130,850)
        elif edge=='r': x=random.gauss(1260,25); y=random.uniform(130,850)
        else: x=random.uniform(420,1260); y=random.gauss(135,20)
        r=random.uniform(1.5,7); col=random.choice([(57,64,55),(78,83,70),(37,44,38)])
        d.ellipse((x-r,y-r,x+r,y+r),fill=col)
    d.rectangle((0,880,w,h),fill=(181,159,135)); d.line((0,880,w,880),fill=(124,112,101),width=5)
    d.rounded_rectangle((42,960,450,1020),radius=12,fill=(0,0,0)); d.text((64,978),'12 AUG 2026  |  WINDOW CORNER',fill='white')
    im=im.filter(ImageFilter.GaussianBlur(.35)); im.save(ROOT/'later-window-condensation-2026-08-12.jpg',quality=92,optimize=True)

    story=[Paragraph('Window replacement notice',styles['H1x']),Paragraph('The bedroom and living-room windows at Klybeckstrasse 77 were replaced between 18 and 22 May 2026. The notice describes new insulated glazing and perimeter sealing.',styles['Bodyx']),Paragraph('Contractor note',styles['H1x']),Paragraph('No indoor humidity, surface-temperature or air-exchange measurements were taken after installation. No post-installation moisture inspection is recorded.',styles['Bodyx'])]
    make_pdf(ROOT/'window-replacement-notice.pdf','Window Replacement Notice','Fictional generated source document - May 2026',story,'window-replacement-notice.pdf')

later_artifacts()



def render_pdf_pages():
    import fitz
    mapping = {
        'lease-agreement.pdf': 'art_lease',
        'defect-timeline.pdf': 'art_timeline',
        'delivery-receipt.pdf': 'art_delivery',
        'window-replacement-notice.pdf': 'art_window_notice',
    }
    for filename, artifact_id in mapping.items():
        pdf_path = ROOT / filename
        out = ROOT / 'pages' / artifact_id
        out.mkdir(parents=True, exist_ok=True)
        doc = fitz.open(pdf_path)
        for index, page in enumerate(doc):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.65, 1.65), alpha=False)
            pix.save(out / f'page-{index + 1}.png')
        doc.close()


render_pdf_pages()
