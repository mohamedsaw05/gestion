import os
import sys
import wave
import subprocess

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import win32com.client
import imageio_ffmpeg

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "client", "public", "videos"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

# Palette de couleurs professionnelle VTM
C_BG_DARK = (15, 23, 42)      # #0f172a
C_SURFACE = (30, 41, 59)      # #1e293b
C_ACCENT_BLUE = (37, 99, 235) # #2563eb
C_ACCENT_TEAL = (16, 185, 129)# #10b981
C_TEXT_WHITE = (248, 250, 252)# #f8fafc
C_TEXT_MUTED = (148, 163, 184)# #94a3b8
C_BORDER = (51, 65, 85)       # #334155
C_HIGHLIGHT = (234, 179, 8)   # #eab308

WIDTH = 1920
HEIGHT = 1080
FPS = 15

def get_font(size, bold=False):
    # Polices système Windows
    candidates = [
        "C:\\Windows\\Fonts\\segoeui.ttf" if not bold else "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arial.ttf" if not bold else "C:\\Windows\\Fonts\\arialbd.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def render_vtm_frame(video_title, section_title, narrator_text, progress_pct, cursor_pos=None, action_box=None, step_badge=""):
    im = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(im)

    font_brand = get_font(28, bold=True)
    font_title = get_font(36, bold=True)
    font_sec = get_font(22, bold=False)
    font_body = get_font(24, bold=False)
    font_bold = get_font(24, bold=True)
    font_sub = get_font(30, bold=True)
    font_small = get_font(18, bold=False)

    # 1. Top Bar Header
    draw.rectangle([0, 0, WIDTH, 80], fill=C_SURFACE)
    draw.line([0, 80, WIDTH, 80], fill=C_BORDER, width=2)

    # Logo VTM & Brand
    draw.rounded_rectangle([40, 16, 120, 64], radius=8, fill=C_ACCENT_BLUE)
    draw.text((54, 24), "VTM", fill=C_TEXT_WHITE, font=font_brand)
    draw.text((135, 24), "ViralTech Market", fill=C_TEXT_WHITE, font=font_brand)
    draw.text((360, 28), "•  Gestionnaire SaaS Universel de Commerce", fill=C_TEXT_MUTED, font=font_sec)

    # Badge Épisode & Titre
    if step_badge:
        draw.rounded_rectangle([WIDTH - 380, 20, WIDTH - 40, 60], radius=8, fill=(59, 130, 246, 40), outline=C_ACCENT_BLUE, width=1)
        draw.text((WIDTH - 365, 27), step_badge, fill=(96, 165, 250), font=font_sec)

    # 2. Sidebar Navigation gauche
    sidebar_w = 340
    draw.rectangle([0, 80, sidebar_w, HEIGHT - 140], fill=(24, 33, 47))
    draw.line([sidebar_w, 80, sidebar_w, HEIGHT - 140], fill=C_BORDER, width=2)

    # Menus de la barre latérale
    nav_items = [
        ("📊", "Tableau de Bord", False),
        ("🛒", "Caisse / Vente POS", "Vente" in video_title or "Encaissement" in video_title),
        ("📦", "Catalogue & Produits", "Produit" in video_title or "Stock" in video_title),
        ("🏢", "Stocks & Dépôts", "Stocks" in video_title),
        ("🔧", "Prestations & Atelier", "Prestation" in video_title or "Atelier" in video_title),
        ("💳", "Clients & Crédit", "Crédit" in video_title),
        ("💸", "Dépenses d'Exploitation", "Dépense" in video_title),
        ("⚙️", "Paramètres & Outils", "Configurer" in video_title or "Espace" in video_title),
    ]

    cur_y = 110
    for icon, label, is_active in nav_items:
        if is_active:
            draw.rounded_rectangle([20, cur_y - 8, sidebar_w - 20, cur_y + 42], radius=8, fill=C_ACCENT_BLUE)
            draw.text((36, cur_y), icon, font=font_sec, fill=C_TEXT_WHITE)
            draw.text((75, cur_y + 2), label, font=font_bold, fill=C_TEXT_WHITE)
        else:
            draw.text((36, cur_y), icon, font=font_sec, fill=C_TEXT_MUTED)
            draw.text((75, cur_y + 2), label, font=font_body, fill=C_TEXT_MUTED)
        cur_y += 58

    # 3. Main Content Workspace
    main_x = sidebar_w + 50
    main_y = 120
    main_w = WIDTH - main_x - 50

    # Titre de la page active
    draw.text((main_x, main_y), video_title, fill=C_TEXT_WHITE, font=font_title)
    draw.text((main_x, main_y + 50), section_title, fill=C_TEXT_MUTED, font=font_sec)

    # Conteneur principal de l'espace de travail
    box_top = main_y + 90
    box_bottom = HEIGHT - 180
    draw.rounded_rectangle([main_x, box_top, main_x + main_w, box_bottom], radius=16, fill=C_SURFACE, outline=C_BORDER, width=2)

    # Décoration spécifique selon la vidéo
    if "Configurer" in video_title or "Espace" in video_title:
        # Formulaire Paramètres
        draw.text((main_x + 40, box_top + 40), "Informations Générales de l'Entreprise", fill=C_TEXT_WHITE, font=font_bold)
        
        # Champ 1: Nom
        draw.text((main_x + 40, box_top + 90), "Nom commercial ou raison sociale :", fill=C_TEXT_MUTED, font=font_sec)
        draw.rounded_rectangle([main_x + 40, box_top + 125, main_x + 650, box_top + 180], radius=8, fill=(15, 23, 42), outline=(59, 130, 246) if progress_pct > 20 else C_BORDER, width=2)
        draw.text((main_x + 55, box_top + 140), "Boutique Savadogo & Frères" if progress_pct > 25 else "Boutique...", fill=C_TEXT_WHITE if progress_pct > 25 else C_TEXT_MUTED, font=font_body)

        # Champ 2: Devise
        draw.text((main_x + 720, box_top + 90), "Devise principale de facturation :", fill=C_TEXT_MUTED, font=font_sec)
        draw.rounded_rectangle([main_x + 720, box_top + 125, main_x + 1150, box_top + 180], radius=8, fill=(15, 23, 42), outline=(16, 185, 129) if progress_pct > 40 else C_BORDER, width=2)
        draw.text((main_x + 735, box_top + 140), "XOF — Franc CFA (BCEAO)", fill=C_TEXT_WHITE, font=font_body)

        # Champ 3: Logo
        draw.text((main_x + 40, box_top + 220), "Logo officiel (affiché sur reçus & factures) :", fill=C_TEXT_MUTED, font=font_sec)
        draw.rounded_rectangle([main_x + 40, box_top + 255, main_x + 500, box_top + 390], radius=12, fill=(15, 23, 42), outline=C_BORDER, width=2)
        draw.rounded_rectangle([main_x + 70, box_top + 275, main_x + 170, box_top + 370], radius=8, fill=C_ACCENT_BLUE)
        draw.text((main_x + 95, box_top + 305), "LOGO", fill=C_TEXT_WHITE, font=font_sec)
        draw.text((main_x + 190, box_top + 295), "logo_officiel_vtm.png", fill=C_TEXT_WHITE, font=font_body)
        draw.text((main_x + 190, box_top + 330), "Prêt pour l'impression thermique et PDF", fill=C_ACCENT_TEAL, font=font_small)

        # Bouton Enregistrer
        btn_save_x1 = main_x + main_w - 280
        btn_save_y1 = box_bottom - 80
        draw.rounded_rectangle([btn_save_x1, btn_save_y1, btn_save_x1 + 240, btn_save_y1 + 55], radius=10, fill=C_ACCENT_TEAL if progress_pct > 70 else C_ACCENT_BLUE)
        draw.text((btn_save_x1 + 45, btn_save_y1 + 14), "✓ Enregistrer l'Espace", fill=C_TEXT_WHITE, font=font_bold)

    elif "Rechercher" in video_title or "Stock" in video_title:
        # Barre de recherche ultra-rapide
        draw.text((main_x + 40, box_top + 40), "Sélecteur de Recherche Instantanée (< 50ms) :", fill=C_TEXT_WHITE, font=font_bold)
        draw.rounded_rectangle([main_x + 40, box_top + 85, main_x + main_w - 40, box_top + 150], radius=10, fill=(15, 23, 42), outline=C_ACCENT_BLUE, width=2)
        draw.text((main_x + 60, box_top + 103), "🔍  Huile" if progress_pct > 20 else "🔍  Scanner un code-barres ou saisir nom, SKU, marque...", fill=C_TEXT_WHITE if progress_pct > 20 else C_TEXT_MUTED, font=font_body)
        
        # Résultats de recherche (max 10)
        draw.text((main_x + 40, box_top + 175), "Résultats contextuels avec stock temps réel :", fill=C_TEXT_MUTED, font=font_sec)
        results = [
            ("ALPHA-002", "Huile 1L Tournesol Pure", "Stock : 48 pièces", "1 200 FCFA", True),
            ("ALPHA-005", "Huile Végétale 5L Bidon", "Stock : 14 pièces", "5 800 FCFA", False),
            ("ALPHA-018", "Huile Moteur 20W50 1L", "Stock : 22 pièces", "3 500 FCFA", False),
        ]
        res_y = box_top + 215
        for sku, name, st, px, is_sel in results:
            fill_c = (37, 99, 235, 60) if is_sel else (15, 23, 42)
            out_c = C_ACCENT_BLUE if is_sel else C_BORDER
            draw.rounded_rectangle([main_x + 40, res_y, main_x + main_w - 40, res_y + 55], radius=8, fill=fill_c, outline=out_c, width=2 if is_sel else 1)
            draw.text((main_x + 60, res_y + 14), sku, fill=C_HIGHLIGHT, font=font_bold)
            draw.text((main_x + 220, res_y + 14), name, fill=C_TEXT_WHITE, font=font_bold)
            draw.text((main_x + 750, res_y + 16), st, fill=C_ACCENT_TEAL, font=font_sec)
            draw.text((main_x + main_w - 200, res_y + 14), px, fill=C_TEXT_WHITE, font=font_bold)
            res_y += 68

    elif "Vente" in video_title or "Point de Vente" in video_title or "Encaissement" in video_title:
        # Caisse POS
        draw.text((main_x + 40, box_top + 35), "Panier de Caisse en Cours", fill=C_TEXT_WHITE, font=font_bold)
        draw.rounded_rectangle([main_x + 40, box_top + 75, main_x + 700, box_bottom - 40], radius=10, fill=(15, 23, 42), outline=C_BORDER)
        draw.text((main_x + 60, box_top + 100), "Riz Parfumé 5kg   x 2   =   9 000 FCFA", fill=C_TEXT_WHITE, font=font_body)
        draw.text((main_x + 60, box_top + 145), "Huile 1L Pure      x 3   =   3 600 FCFA", fill=C_TEXT_WHITE, font=font_body)
        draw.line([main_x + 60, box_top + 200, main_x + 680, box_top + 200], fill=C_BORDER)
        draw.text((main_x + 60, box_top + 220), "TOTAL À PAYER :  12 600 FCFA", fill=C_HIGHLIGHT, font=font_title)

        # Panneau Règlement
        p_x = main_x + 740
        draw.text((p_x, box_top + 35), "Modalité d'Encaissement", fill=C_TEXT_WHITE, font=font_bold)
        methods = [("💵 Espèces", True), ("📱 Orange Money / Wave", False), ("💳 Carte Bancaire", False)]
        m_y = box_top + 80
        for m_name, m_sel in methods:
            draw.rounded_rectangle([p_x, m_y, p_x + 400, m_y + 50], radius=8, fill=C_ACCENT_BLUE if m_sel else (15, 23, 42), outline=C_BORDER)
            draw.text((p_x + 30, m_y + 12), m_name, fill=C_TEXT_WHITE, font=font_bold)
            m_y += 65
        draw.rounded_rectangle([p_x, box_bottom - 90, p_x + 400, box_bottom - 35], radius=10, fill=C_ACCENT_TEAL)
        draw.text((p_x + 110, box_bottom - 74), "✓ Valider & Imprimer Reçu", fill=C_TEXT_WHITE, font=font_bold)

    elif "Prestation" in video_title or "Atelier" in video_title:
        # Prestations & Services
        draw.text((main_x + 40, box_top + 35), "Dossier d'Intervention Atelier #SRV-2026-004", fill=C_TEXT_WHITE, font=font_bold)
        draw.rounded_rectangle([main_x + 40, box_top + 80, main_x + main_w - 40, box_top + 160], radius=10, fill=(15, 23, 42), outline=C_BORDER)
        draw.text((main_x + 60, box_top + 98), "Client : Ali Ouédraogo   •   Véhicule : Toyota Hilux 11-JJ-4521   •   Statut : EN COURS", fill=C_TEXT_WHITE, font=font_body)
        draw.text((main_x + 60, box_top + 130), "Technicien assigné : Moussa K.   •   Diagnostic : Révision générale et plaquettes de frein", fill=C_ACCENT_TEAL, font=font_small)

        # Lignes atelier
        draw.text((main_x + 40, box_top + 185), "Lignes de Main-d'œuvre & Pièces détachées décrémentées du stock :", fill=C_TEXT_MUTED, font=font_sec)
        draw.text((main_x + 60, box_top + 225), "• [MAIN D'ŒUVRE] Forfait Vidange & Révision Moteur (2h) — 15 000 FCFA", fill=C_TEXT_WHITE, font=font_body)
        draw.text((main_x + 60, box_top + 265), "• [PIÈCE STOCK]  Filtre à Huile Hilux D4D (Qté: 1, Sorti du stock Dépôt) — 8 500 FCFA", fill=C_HIGHLIGHT, font=font_body)
        draw.text((main_x + 60, box_top + 305), "• [PIÈCE STOCK]  Plaquettes de frein avant (Qté: 1 jeu, Sorti du stock) — 22 000 FCFA", fill=C_HIGHLIGHT, font=font_body)

        draw.rounded_rectangle([main_x + main_w - 320, box_bottom - 80, main_x + main_w - 40, box_bottom - 25], radius=10, fill=C_ACCENT_TEAL)
        draw.text((main_x + main_w - 290, box_bottom - 65), "Facturer le Dossier (45 500 F)", fill=C_TEXT_WHITE, font=font_bold)

    else:
        # Présentation générale & Autres modules
        draw.text((main_x + 40, box_top + 35), "Architecture Modulaire & Flux Temps Réel VTM", fill=C_TEXT_WHITE, font=font_bold)
        
        cards = [
            ("⚡ Vente & Caisse POS", "Encaissement ultra-rapide, tickets certifiés, multi-devises"),
            ("🏢 Stock Multi-Boutiques", "Mouvements append-only, zéro stock négatif non autorisé"),
            ("📈 Coûts d'Achat & Marges", "Snapshot immuable à la vente, rentabilité réelle par produit"),
            ("🔧 Services & Atelier", "Gestion d'interventions, pièces sorties de stock, facturation"),
            ("💸 Dépenses & Trésorerie", "Circuit d'approbation > 500k, réconciliation caisse"),
            ("🛡️ Sécurité & Portabilité", "RLS PostgreSQL multi-tenant, exports SQL/JSON intégrals"),
        ]
        grid_y = box_top + 80
        for i, (ct, cd) in enumerate(cards):
            col = i % 2
            row = i // 2
            cx = main_x + 40 + col * 550
            cy = grid_y + row * 95
            is_hl = (row == 0 and col == 0 and progress_pct < 40) or (row == 1 and progress_pct >= 40)
            draw.rounded_rectangle([cx, cy, cx + 510, cy + 80], radius=10, fill=(37, 99, 235, 50) if is_hl else (15, 23, 42), outline=C_ACCENT_BLUE if is_hl else C_BORDER, width=2 if is_hl else 1)
            draw.text((cx + 20, cy + 12), ct, fill=C_TEXT_WHITE, font=font_bold)
            draw.text((cx + 20, cy + 44), cd, fill=C_TEXT_MUTED, font=font_small)

    # 4. Action Box / Curseur de souris
    if action_box:
        ax1, ay1, ax2, ay2 = action_box
        draw.rounded_rectangle([ax1, ay1, ax2, ay2], radius=10, outline=C_HIGHLIGHT, width=3)

    if cursor_pos:
        cx, cy = cursor_pos
        # Dessin du curseur de souris (flèche)
        draw.polygon([(cx, cy), (cx, cy + 24), (cx + 6, cy + 18), (cx + 16, cy + 26), (cx + 20, cy + 22), (cx + 10, cy + 14), (cx + 18, cy + 14)], fill=(255, 255, 255), outline=(0, 0, 0))

    # 5. Bottom Subtitles Banner (Karaoke)
    sub_y = HEIGHT - 130
    draw.rectangle([0, sub_y, WIDTH, HEIGHT], fill=(11, 15, 25))
    draw.line([0, sub_y, WIDTH, sub_y], fill=C_BORDER, width=2)

    # Barre de progression vidéo en bas
    prog_w = int(WIDTH * (progress_pct / 100.0))
    draw.rectangle([0, HEIGHT - 8, prog_w, HEIGHT], fill=C_ACCENT_TEAL)

    # Texte du sous-titre
    draw.text((80, sub_y + 25), "🎙️  VTM — " + narrator_text, fill=C_TEXT_WHITE, font=font_sub)
    draw.text((WIDTH - 200, sub_y + 35), f"{int(progress_pct)}%", fill=C_TEXT_MUTED, font=font_sec)

    return np.array(im)

def generate_video_audio(text, wav_path):
    speaker = win32com.client.Dispatch("SAPI.SpVoice")
    # Choisir la voix française (Microsoft Hortense)
    for v in speaker.GetVoices():
        if "French" in v.GetDescription() or "Hortense" in v.GetDescription():
            speaker.Voice = v
            break
    
    file_stream = win32com.client.Dispatch("SAPI.SpFileStream")
    file_stream.Open(wav_path, 3, False)
    speaker.AudioOutputStream = file_stream
    speaker.Rate = 0 # Cadence normale
    speaker.Speak(text)
    file_stream.Close()

    # Mesurer la durée en secondes
    with wave.open(wav_path, "r") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)

def build_vtm_video(video_id, title, sec_title, segments, step_badge):
    import tempfile
    mp4_filename = f"{video_id}.mp4"
    final_mp4_path = os.path.join(OUTPUT_DIR, mp4_filename)
    vtt_path = os.path.join(OUTPUT_DIR, f"{video_id}.vtt")
    txt_path = os.path.join(OUTPUT_DIR, f"{video_id}_transcription.txt")
    thumb_path = os.path.join(OUTPUT_DIR, f"{video_id}_thumb.jpg")

    if os.path.exists(final_mp4_path) and os.path.getsize(final_mp4_path) > 100000:
        print(f"[SKIP] Video {mp4_filename} existe deja ({os.path.getsize(final_mp4_path)} octets).")
        return {
            "id": video_id,
            "filename": mp4_filename,
            "path": final_mp4_path,
            "duration": 36.0,
            "vtt": vtt_path,
            "txt": txt_path,
            "thumb": thumb_path,
            "title": title,
        }

    temp_dir = tempfile.gettempdir()
    raw_video_path = os.path.join(temp_dir, f"{video_id}_temp.mp4")
    wav_path = os.path.join(temp_dir, f"{video_id}_audio.wav")

    print(f"\n=======================================================")
    print(f"[*] Production video : {mp4_filename}")
    print(f"=======================================================")

    # 1. Génération de l'audio combiné et mesure des temps
    full_text = " ".join([seg["text"] for seg in segments])
    audio_dur = generate_video_audio(full_text, wav_path)
    print(f"[+] Audio genere (duree: {audio_dur:.2f}s)")

    # 2. Génération des sous-titres VTT et de la transcription
    vtt_lines = ["WEBVTT", ""]
    txt_lines = [f"TRANSCRIPTION DU TUTORIEL : {title}", f"Identité : VTM — ViralTech Market", ""]
    
    cur_time = 0.0
    seg_timings = []
    total_words = sum([len(seg["text"].split()) for seg in segments])
    
    for idx, seg in enumerate(segments):
        words_count = len(seg["text"].split())
        seg_dur = (words_count / float(total_words)) * audio_dur
        start_t = cur_time
        end_t = cur_time + seg_dur
        cur_time = end_t
        seg_timings.append((start_t, end_t, seg))

        # Format VTT: 00:00:01.000 --> 00:00:04.500
        def fmt(t):
            m = int(t // 60)
            s = int(t % 60)
            ms = int((t - int(t)) * 1000)
            return f"00:{m:02d}:{s:02d}.{ms:03d}"

        vtt_lines.append(f"{idx + 1}")
        vtt_lines.append(f"{fmt(start_t)} --> {fmt(end_t)}")
        vtt_lines.append(seg["text"])
        vtt_lines.append("")
        txt_lines.append(f"[{fmt(start_t)}] {seg['text']}")

    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_lines))

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(txt_lines))

    # 3. Rendu des images vidéo
    total_frames = int(audio_dur * FPS)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(raw_video_path, fourcc, FPS, (WIDTH, HEIGHT))

    thumbnail_saved = False

    for frame_idx in range(total_frames):
        cur_sec = frame_idx / float(FPS)
        prog_pct = (cur_sec / audio_dur) * 100.0

        # Trouver le segment actif
        active_seg = segments[0]
        for st, et, seg in seg_timings:
            if st <= cur_sec <= et:
                active_seg = seg
                break

        # Animation du curseur
        cursor_x = 200 + int((WIDTH - 400) * (prog_pct / 100.0))
        cursor_y = 350 + int(np.sin(prog_pct / 5.0) * 80)

        frame = render_vtm_frame(
            video_title=title,
            section_title=sec_title,
            narrator_text=active_seg["text"],
            progress_pct=prog_pct,
            cursor_pos=(cursor_x, cursor_y),
            step_badge=step_badge
        )

        # Sauvegarder la miniature à mi-parcours
        if not thumbnail_saved and frame_idx >= total_frames // 3:
            im_thumb = Image.fromarray(frame)
            im_thumb.save(thumb_path, quality=92)
            thumbnail_saved = True

        # OpenCV utilise BGR
        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        out.write(frame_bgr)

    out.release()
    print(f"[+] Rendu video brut termine ({total_frames} frames a {FPS} fps)")

    # 4. Multiplexage FFmpeg en MP4 final (H.264 + AAC)
    cmd = [
        FFMPEG_EXE, "-y",
        "-i", raw_video_path,
        "-i", wav_path,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        final_mp4_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"[+] Video MP4 finale generee : {final_mp4_path} ({os.path.getsize(final_mp4_path)} octets)")

    # Nettoyer les fichiers temporaires
    if os.path.exists(raw_video_path): os.remove(raw_video_path)
    if os.path.exists(wav_path): os.remove(wav_path)

    return {
        "id": video_id,
        "filename": mp4_filename,
        "path": final_mp4_path,
        "duration": audio_dur,
        "vtt": vtt_path,
        "txt": txt_path,
        "thumb": thumb_path,
        "title": title,
    }

# Définition des 8 vidéos requises
VIDEOS_CONFIG = [
    {
        "id": "VTM_01_Presentation_Generale_FR",
        "title": "VTM — Présentation Générale du Gestionnaire",
        "sec_title": "Gestion commerciale SaaS tout-en-un pour entreprises et réseaux de boutiques",
        "badge": "Épisode 1 • Présentation (50s)",
        "segments": [
            {"text": "Bienvenue chez VTM, ViralTech Market ! Découvrez le Gestionnaire Universel de Commerce, la solution SaaS tout-en-un pour piloter votre entreprise."},
            {"text": "Depuis votre tableau de bord, gérez vos ventes, vos stocks multi-boutiques et vos collaborateurs avec une isolation totale des données."},
            {"text": "Profitez de la caisse tactile rapide, de la rentabilité exacte par produit et d'un atelier complet pour vos prestations de services."},
            {"text": "Dans la prochaine vidéo, découvrez comment configurer votre espace de travail, vos coordonnées et votre logo officiel."}
        ]
    },
    {
        "id": "VTM_02_Configurer_Son_Espace_FR",
        "title": "Configurer son Espace de Travail",
        "sec_title": "Raison sociale, devise principale, logo officiel et création des boutiques",
        "badge": "Épisode 2 • Configuration (45s)",
        "segments": [
            {"text": "Tutoriel VTM : Configurer votre espace. Rendez-vous dans le menu Paramètres situé dans la barre latérale gauche."},
            {"text": "Indiquez la raison sociale de votre boutique, votre adresse, et choisissez votre devise de facturation, comme le Franc CFA XOF."},
            {"text": "Importez votre logo officiel : il apparaîtra automatiquement sur vos factures, devis et tickets de caisse imprimés."},
            {"text": "Créez vos magasins et dépôts dans Emplacements puis enregistrez. Prochaine étape : la recherche de produits et consultation de stock !"}
        ]
    },
    {
        "id": "VTM_03_Rechercher_Produit_Stock_FR",
        "title": "Recherche Rapide & Consultation des Stocks",
        "sec_title": "Moteur contextuel, lecture code-barres et niveaux de stock en temps réel",
        "badge": "Épisode 3 • Catalogue & Stock (40s)",
        "segments": [
            {"text": "Tutoriel VTM : Recherche rapide d'articles. Retrouvez instantanément n'importe quel produit parmi des milliers de références."},
            {"text": "Saisissez un fragment de nom, une référence SKU ou scannez directement le code-barres. Les résultats apparaissent en moins de cinquante millisecondes."},
            {"text": "Consultez le stock disponible en temps réel, l'emplacement et le prix unitaire, même avec de légères fautes de frappe."},
            {"text": "Sélectionnez l'article pour l'ajouter à votre vente. Rendez-vous dans la vidéo suivante pour découvrir la caisse tactile !"}
        ]
    },
    {
        "id": "VTM_04_Point_De_Vente_Et_Encaissement_FR",
        "title": "Point de Vente & Caisse Tactile",
        "sec_title": "Panier d'articles, encaissements multi-moyens et impression du reçu de caisse",
        "badge": "Épisode 4 • Caisse POS (38s)",
        "segments": [
            {"text": "Tutoriel VTM : Caisse enregistreuse et encaissement. Encaissez rapidement vos clients au comptoir avec notre interface tactile."},
            {"text": "Ajoutez les articles au panier d'un simple clic. Choisissez le moyen de paiement : espèces, carte ou mobile money."},
            {"text": "La validation décrémente immédiatement les stocks et génère un ticket de caisse certifié conforme, sans risque de doublon."},
            {"text": "Chaque transaction est sécurisée. Dans le prochain épisode, découvrez le module complet de prestations et d'atelier !"}
        ]
    },
    {
        "id": "VTM_05_Prestations_Et_Atelier_FR",
        "title": "Prestations de Services & Atelier",
        "sec_title": "Dossiers d'intervention, pièces sorties du stock et facturation directe",
        "badge": "Épisode 5 • Atelier & Services (38s)",
        "segments": [
            {"text": "Tutoriel VTM : Prestations et Services d'Atelier. Gérez vos réparations et interventions sans bloquer vos services par un stock inexistant."},
            {"text": "Créez un dossier client, indiquez le diagnostic et affectez un technicien. Ajoutez les heures de main-d'œuvre et les pièces nécessaires."},
            {"text": "Les pièces détachées consommées sont automatiquement décrémentées du stock physique et valorisées à leur coût d'achat exact."},
            {"text": "Une fois l'intervention achevée, facturez le dossier en un clic. Épisode suivant : le suivi des dépenses d'exploitation !"}
        ]
    },
    {
        "id": "VTM_06_Depenses_Et_Tresorerie_FR",
        "title": "Dépenses d'Exploitation & Trésorerie",
        "sec_title": "Charges courantes, justificatifs, réconciliation caisse et circuit d'approbation",
        "badge": "Épisode 6 • Dépenses (38s)",
        "segments": [
            {"text": "Tutoriel VTM : Dépenses et Trésorerie. Maîtrisez les charges opérationnelles de votre commerce avec précision."},
            {"text": "Enregistrez loyers, factures et salaires en attachant le justificatif. Les dépenses en espèces se réconcilient immédiatement avec la caisse."},
            {"text": "Au-delà de cinq cent mille Francs CFA, un circuit d'approbation gérant se déclenche pour sécuriser vos décaissements."},
            {"text": "Consultez vos rapports de charges par catégorie. Prochain épisode : la traçabilité des mouvements de stock !"}
        ]
    },
    {
        "id": "VTM_07_Stocks_Et_Mouvements_FR",
        "title": "Traçabilité des Stocks & Transferts",
        "sec_title": "Journal append-only, alertes de rupture, réapprovisionnements et transferts",
        "badge": "Épisode 7 • Stocks & Dépôts (38s)",
        "segments": [
            {"text": "Tutoriel VTM : Gestion des Stocks et Mouvements. Assurez la traçabilité intégrale de vos marchandises entre vos dépôts."},
            {"text": "Chaque entrée, vente ou ajustement est inscrit dans un journal immuable. Les alertes automatiques préviennent toute rupture."},
            {"text": "Transférez facilement des marchandises d'un entrepôt vers une boutique avec suivi rigoureux des quantités en transit."},
            {"text": "Valorisez votre inventaire au coût moyen pondéré. Prochain épisode : les créances clients et le recouvrement !"}
        ]
    },
    {
        "id": "VTM_08_Credits_Et_Recouvrement_FR",
        "title": "Crédits Clients & Recouvrement Conforme",
        "sec_title": "Plafonds de dette, balance âgée, relevé PDF et politique stricte WhatsApp Meta",
        "badge": "Épisode 8 • Crédit & CRM (40s)",
        "segments": [
            {"text": "Tutoriel VTM : Crédit Client et Recouvrement Conforme. Suivez vos créances avec rigueur tout en respectant les plafonds autorisés."},
            {"text": "Consultez la balance âgée de chaque client, enregistrez les règlements partiels et téléchargez le relevé de compte officiel en PDF."},
            {"text": "Pour vos relances, privilégiez l'Email ou le SMS. Rappel strict : les relances d'impayés sont formellement bloquées sur WhatsApp selon la politique Meta."},
            {"text": "Félicitations ! Vous maîtrisez désormais les fonctionnalités fondamentales du Gestionnaire SaaS VTM — ViralTech Market."}
        ]
    }
]

if __name__ == "__main__":
    import cv2
    results = []
    for cfg in VIDEOS_CONFIG:
        res = build_vtm_video(
            video_id=cfg["id"],
            title=cfg["title"],
            sec_title=cfg["sec_title"],
            segments=cfg["segments"],
            step_badge=cfg["badge"]
        )
        results.append(res)
    
    print("\n[SUCCESS] TOUTES LES VIDEOS VTM ONT ETE GENEREES AVEC SUCCES !")
    for r in results:
        print(f"  - {r['filename']} : {r['duration']:.1f}s | {r['path']}")
