from io import BytesIO
from decimal import Decimal
from typing import Dict, List, Any
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def format_currency(val: Decimal) -> str:
    if val is None:
        return "Rs. 0.00"
    return f"Rs. {val:,.2f}"

def format_date(val) -> str:
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    return val.strftime("%d %b %Y")

def get_val(obj: Any, key: str, default: Any = None) -> Any:
    """
    Safely retrieve an attribute/key value from a SQLAlchemy model instance,
    dict, or generic object to prevent AttributeError when mixing types.
    """
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)

def generate_invoice_pdf(
    invoice: Any,
    client: Any,
    user: Any,
    items: List[Any],
    bank_details: Dict[str, Any] = None
) -> bytes:
    """
    Generate an invoice PDF binary using ReportLab.
    Outputs a clean, professional, A4-proportioned layout matching the brand design.
    """
    buffer = BytesIO()
    
    # 1. Setup Document Template (A4 portrait, 0.5 inch margins = 36 points)
    # A4 dimensions are 595.27 x 841.89 points. 
    # Printable width: 595 - 72 = 523 points.
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    # 2. Setup Styles
    styles = getSampleStyleSheet()
    
    # Create or update styles with standard Helvetica font stack
    style_normal = ParagraphStyle(
        "InvoiceNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#475569")  # slate-600
    )
    
    style_brand = ParagraphStyle(
        "InvoiceBrand",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#4F46E5")  # primary indigo
    )
    
    style_title = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),  # slate-900
        alignment=TA_RIGHT
    )
    
    style_h3 = ParagraphStyle(
        "InvoiceH3",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#94A3B8"),  # slate-400
        spaceAfter=4
    )
    
    style_party_name = ParagraphStyle(
        "InvoicePartyName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#1E293B"),  # slate-800
        spaceAfter=4
    )
    
    style_meta_label = ParagraphStyle(
        "MetaLabel",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748B"),
        alignment=TA_CENTER
    )
    
    style_meta_val = ParagraphStyle(
        "MetaValue",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1E293B"),
        alignment=TA_CENTER
    )

    style_th = ParagraphStyle(
        "TableHead",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#475569")
    )
    
    style_th_center = ParagraphStyle(
        "TableHeadCenter",
        parent=style_th,
        alignment=TA_CENTER
    )

    style_th_right = ParagraphStyle(
        "TableHeadRight",
        parent=style_th,
        alignment=TA_RIGHT
    )

    style_td = ParagraphStyle(
        "TableCell",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155")
    )
    
    style_td_bold = ParagraphStyle(
        "TableCellBold",
        parent=style_td,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0F172A")
    )

    style_td_center = ParagraphStyle(
        "TableCellCenter",
        parent=style_td,
        alignment=TA_CENTER
    )

    style_td_right = ParagraphStyle(
        "TableCellRight",
        parent=style_td,
        alignment=TA_RIGHT
    )

    story = []

    # --- SECTION 1: HEADER (Brand Name & Document Title + Badge) ---
    status_str = get_val(invoice, "status", "Draft")
    status_lower = status_str.lower()
    
    # Configure status badge background & text colors
    badge_colors = {
        "paid": (colors.HexColor("#DCFCE7"), colors.HexColor("#15803D")),
        "sent": (colors.HexColor("#DBEAFE"), colors.HexColor("#1D4ED8")),
        "overdue": (colors.HexColor("#FEE2E2"), colors.HexColor("#B91C1C")),
        "draft": (colors.HexColor("#F1F5F9"), colors.HexColor("#475569")),
    }
    badge_bg, badge_txt = badge_colors.get(status_lower, (colors.HexColor("#F1F5F9"), colors.HexColor("#475569")))

    badge_p_style = ParagraphStyle(
        "BadgeText",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=badge_txt,
        alignment=TA_CENTER
    )

    # Status Badge cell table
    badge_table = Table([[Paragraph(status_str.upper(), badge_p_style)]], colWidths=[60], rowHeights=[16])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), badge_bg),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))

    # Combine title & status on the right side
    right_cell_elements = [
        Paragraph("INVOICE", style_title),
        Spacer(1, 4),
        Table([[badge_table]], colWidths=[200], hAlign='RIGHT')
    ]

    user_name = get_val(user, "business_name") or get_val(user, "name", "Freelancer")
    user_gst = get_val(user, "gst_number")
    left_cell_elements = [
        Paragraph(user_name or "Freelancer Invoices", style_brand),
    ]
    if user_gst:
        left_cell_elements.append(Spacer(1, 4))
        left_cell_elements.append(Paragraph(f"GSTIN: {user_gst}", style_normal))

    # Header layout table (width: 310 + 210 = 520)
    header_table = Table([[left_cell_elements, right_cell_elements]], colWidths=[310, 210])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 20))

    # --- SECTION 2: METADATA BAR (Invoice Num, Issue Date, Due Date) ---
    inv_num = get_val(invoice, "invoice_number", "")
    issue_dt = format_date(get_val(invoice, "issue_date", ""))
    due_dt = format_date(get_val(invoice, "due_date", ""))

    meta_table_data = [
        [
            [Paragraph("INVOICE NUMBER", style_meta_label), Spacer(1, 2), Paragraph(inv_num, style_meta_val)],
            [Paragraph("DATE OF ISSUE", style_meta_label), Spacer(1, 2), Paragraph(issue_dt, style_meta_val)],
            [Paragraph("DUE DATE", style_meta_label), Spacer(1, 2), Paragraph(due_dt, style_meta_val)]
        ]
    ]
    # Widths: 173 * 3 = 519
    meta_table = Table(meta_table_data, colWidths=[173, 173, 173])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 25))

    # --- SECTION 3: PARTIES DETAIL GRID (From vs Bill To) ---
    # From column contents
    from_details = []
    user_email = get_val(user, "email")
    user_phone = get_val(user, "phone")
    user_addr = get_val(user, "address")
    
    if user_email:
        from_details.append(Paragraph(f"Email: {user_email}", style_normal))
    if user_phone:
        from_details.append(Paragraph(f"Phone: {user_phone}", style_normal))
    if user_addr:
        from_details.append(Paragraph(user_addr, style_normal))

    from_column = [
        Paragraph("FROM", style_h3),
        Paragraph(user_name or "Freelancer Name", style_party_name),
    ] + from_details

    # Bill To column contents
    to_details = []
    client_name = get_val(client, "name", "Client")
    client_addr = get_val(client, "address")
    client_email = get_val(client, "email")
    client_phone = get_val(client, "phone")
    client_gst = get_val(client, "gst_number")

    if client_addr:
        to_details.append(Paragraph(client_addr, style_normal))
    if client_email:
        to_details.append(Paragraph(f"<b>Email:</b> {client_email}", style_normal))
    if client_phone:
        to_details.append(Paragraph(f"<b>Phone:</b> {client_phone}", style_normal))
    if client_gst:
        to_details.append(Paragraph(f"<b>GSTIN:</b> {client_gst}", style_normal))

    to_column = [
        Paragraph("BILL TO", style_h3),
        Paragraph(client_name, style_party_name),
    ] + to_details

    # Parties layout table (Width: 260 + 260 = 520)
    parties_table = Table([[from_column, to_column]], colWidths=[260, 260])
    parties_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(parties_table)
    story.append(Spacer(1, 25))

    # --- SECTION 4: LINE ITEMS TABLE ---
    # Widths: Description (260), Qty (60), Rate (100), Amount (100) = 520
    item_table_data = [
        [
            Paragraph("Description", style_th),
            Paragraph("Qty", style_th_center),
            Paragraph("Rate", style_th_right),
            Paragraph("Amount", style_th_right)
        ]
    ]

    for item in items:
        desc = get_val(item, "description", "")
        qty = get_val(item, "quantity", 0)
        rate = get_val(item, "rate", 0)
        
        # Calculate amount safely
        d_qty = Decimal(str(qty)) if qty is not None else Decimal("0.00")
        d_rate = Decimal(str(rate)) if rate is not None else Decimal("0.00")
        amount = d_qty * d_rate

        item_table_data.append([
            Paragraph(desc, style_td_bold),
            Paragraph(f"{d_qty:.2f}", style_td_center),
            Paragraph(format_currency(d_rate), style_td_right),
            Paragraph(format_currency(amount), style_td_right)
        ])

    items_table = Table(item_table_data, colWidths=[260, 60, 100, 100])
    
    # Build Table Style
    t_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('LINEBELOW', (0,0), (-1,0), 1.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]
    # Add row dividers for items
    for i in range(1, len(item_table_data)):
        t_style.append(('LINEBELOW', (0, i), (-1, i), 0.5, colors.HexColor("#F1F5F9")))
        
    items_table.setStyle(TableStyle(t_style))
    story.append(items_table)
    story.append(Spacer(1, 15))

    # --- SECTION 5: TOTALS BLOCK ---
    subtotal = get_val(invoice, "subtotal", Decimal("0.00"))
    gst_rate = get_val(invoice, "gst_rate", Decimal("18.00"))
    gst_amount = get_val(invoice, "gst_amount", Decimal("0.00"))
    total_amount = get_val(invoice, "total_amount", Decimal("0.00"))

    totals_data = [
        [Paragraph("Subtotal", style_td), Paragraph(format_currency(subtotal), style_td_right)],
        [Paragraph(f"GST ({gst_rate:.2f}%)", style_td), Paragraph(format_currency(gst_amount), style_td_right)],
        [
            Paragraph("Total Amount", style_td_bold),
            Paragraph(f"<font color='#4F46E5'><b>{format_currency(total_amount)}</b></font>", style_td_right)
        ]
    ]
    totals_table = Table(totals_data, colWidths=[100, 100])
    totals_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 2), (-1, 2), 1.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))

    # Align totals block to the right (empty left column width 320, totals table width 200)
    totals_align_table = Table([["", totals_table]], colWidths=[320, 200])
    totals_align_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(totals_align_table)
    story.append(Spacer(1, 25))

    # --- SECTION 6: NOTES & BANK Transfer Details ---
    # Left: Notes card
    notes_content = [
        Paragraph("Payment Terms & Notes", style_h3),
        Paragraph(
            "Please make the payment by the due date mentioned above. Standard interest rates or overdue policies may apply for delayed payments.",
            style_normal
        ),
        Spacer(1, 4),
        Paragraph(
            "If you have any questions concerning this invoice, contact the email listed above. Thank you for your business!",
            style_normal
        )
    ]

    # Right: Bank transfer details card
    bank_card_content = [Paragraph("Bank Transfer Details", style_h3), Spacer(1, 4)]
    if bank_details:
        bank_name = bank_details.get("bank_name", "N/A")
        acc_holder = bank_details.get("account_holder_name") or user_name or "N/A"
        acc_num = bank_details.get("account_number", "N/A")
        ifsc = bank_details.get("ifsc_code", "N/A")
        
        bank_card_table_data = [
            [Paragraph("Bank:", style_td), Paragraph(bank_name, style_td_bold)],
            [Paragraph("Acc Name:", style_td), Paragraph(acc_holder, style_td_bold)],
            [Paragraph("Acc No:", style_td), Paragraph(acc_num, style_td_bold)],
            [Paragraph("IFSC:", style_td), Paragraph(ifsc, style_td_bold)]
        ]
        bank_table = Table(bank_card_table_data, colWidths=[65, 125])
        bank_table.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        bank_card_content.append(bank_table)
    else:
        bank_card_content.append(Paragraph("No bank details configured.", style_normal))

    # Wrap bank details in a bordered box
    bank_outer_table = Table([[bank_card_content]], colWidths=[200])
    bank_outer_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    # Bottom layout grid (Width: 300 + 220 = 520)
    bottom_grid = Table([[notes_content, bank_outer_table]], colWidths=[300, 220])
    bottom_grid.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(bottom_grid)
    story.append(Spacer(1, 40))

    # --- SECTION 7: FOOTER ---
    style_footer = ParagraphStyle(
        "InvoiceFooter",
        parent=style_normal,
        fontSize=8,
        textColor=colors.HexColor("#94A3B8"),
        alignment=TA_CENTER
    )
    story.append(Paragraph("Generated electronically. Powered by Freelancer Invoice Tracker.", style_footer))

    # 3. Build PDF Document
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
