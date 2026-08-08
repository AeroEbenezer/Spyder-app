import os
import io
import uuid
import streamlit as st
from pypdf import PdfReader
from elevenlabs.client import ElevenLabs
from supabase import create_client, Client

# ==========================================
# 1. PAGE CONFIG & APP INTERFACE STYLING
# ==========================================
st.set_page_config(
    page_title="SPYDER",
    page_icon="⚡",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Custom App CSS - Hides web chrome & transforms UI into a native app container
st.markdown("""
    <style>
    /* Hide default web chrome (Streamlit header, footer, deploy button) */
    #MainMenu {visibility: hidden;}
    header {visibility: hidden;}
    footer {visibility: hidden;}
    .stDeployButton {display: none;}
    
    /* Deep OLED Background */
    .stApp {
        background: #09090C;
        color: #F4F4F6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    /* Center and constrain main app frame */
    .block-container {
        padding-top: 1.5rem !important;
        padding-bottom: 3rem !important;
        max-width: 620px !important;
    }
    
    /* Branded App Header Card */
    .spyder-brand-card {
        background: linear-gradient(180deg, #12111A 0%, #09090C 100%);
        border: 1px solid #231F33;
        border-radius: 16px;
        padding: 28px 20px;
        text-align: center;
        margin-bottom: 25px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .spyder-logo-icon {
        width: 52px;
        height: 52px;
        background: linear-gradient(135deg, #DF00FF 0%, #7000FF 100%);
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
        box-shadow: 0 0 22px rgba(223, 0, 255, 0.45);
        margin-bottom: 12px;
    }
    .spyder-title {
        font-size: 32px;
        font-weight: 900;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #FFFFFF 0%, #B5B5C3 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
    }
    .spyder-tagline {
        color: #8E8A9F;
        font-size: 13px;
        font-weight: 500;
        margin-top: 4px;
        letter-spacing: 0.5px;
    }

    /* Modern Primary Action Button */
    .stButton>button {
        background: linear-gradient(135deg, #DF00FF 0%, #9000FF 100%) !important;
        color: #FFFFFF !important;
        font-weight: 700 !important;
        font-size: 15px !important;
        border-radius: 10px !important;
        border: none !important;
        width: 100% !important;
        padding: 0.75rem 1.5rem !important;
        box-shadow: 0 4px 20px rgba(223, 0, 255, 0.35) !important;
        transition: all 0.2s ease-in-out !important;
        letter-spacing: 0.5px;
    }
    .stButton>button:hover {
        box-shadow: 0 6px 28px rgba(223, 0, 255, 0.6) !important;
        transform: translateY(-2px) !important;
    }

    /* Custom File Dropzone Container */
    .stFileUploader {
        background-color: #12111A;
        border: 1px dashed #342E4A;
        border-radius: 14px;
        padding: 8px;
    }
    
    /* Audio Player Output Card */
    .audio-card {
        background: #12111A;
        border: 1px solid #231F33;
        border-radius: 14px;
        padding: 20px;
        margin-top: 20px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    </style>
""", unsafe_allow_html=True)

# Custom App Logo & Header Banner
st.markdown("""
    <div class="spyder-brand-card">
        <div class="spyder-logo-icon">🕷️</div>
        <h1 class="spyder-title">SPYDER</h1>
        <div class="spyder-tagline">Quiet, ruthless productivity.</div>
    </div>
""", unsafe_allow_html=True)

# ==========================================
# 2. CLIENT INITIALIZATION
# ==========================================
elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

if not elevenlabs_key or not supabase_url or not supabase_key:
    st.error("Missing API credentials in environment secrets.")
    st.stop()

eleven_client = ElevenLabs(api_key=elevenlabs_key)
supabase: Client = create_client(supabase_url, supabase_key)

# ==========================================
# 3. HELPER FUNCTIONS
# ==========================================
def extract_text_from_pdf(pdf_file) -> str:
    """Extracts text content from an uploaded PDF file."""
    reader = PdfReader(pdf_file)
    extracted_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            extracted_text += text + "\n"
    return extracted_text.strip()

def upload_to_supabase_storage(file_bytes: bytes, filename: str) -> str:
    """Uploads MP3 bytes to Supabase Storage bucket and returns public URL."""
    storage_path = f"public/{uuid.uuid4()}_{filename}"
    
    supabase.storage.from_("audiobooks").upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "audio/mpeg"}
    )
    
    return supabase.storage.from_("audiobooks").get_public_url(storage_path)

def log_audiobook_to_db(title: str, audio_url: str, file_size: int):
    """Inserts metadata record into database."""
    dummy_user_id = "00000000-0000-0000-0000-000000000000"
    data = {
        "user_id": dummy_user_id,
        "title": title,
        "audio_file_url": audio_url,
        "file_size_bytes": file_size
    }
    try:
        supabase.table("audiobooks").insert(data).execute()
    except Exception:
        pass

# ==========================================
# 4. APP INTERFACE & PIPELINE
# ==========================================
uploaded_file = st.file_uploader("Drop document", type=["pdf"], label_visibility="collapsed")

if uploaded_file is not None:
    st.caption(f"Attached: **{uploaded_file.name}** ({round(uploaded_file.size / 1024, 1)} KB)")
    
    if st.button("Synthesize Audio 🎧"):
        with st.status("Processing document...", expanded=True) as status:
            st.write("📄 Extracting text...")
            raw_text = extract_text_from_pdf(uploaded_file)
            
            if not raw_text:
                st.error("No readable text found in document.")
                st.stop()
            
            input_text = raw_text[:4000]
            
            st.write("🎙️ Generating high-fidelity voice stream...")
            
            # Fixed ElevenLabs v1.x SDK syntax
            audio_generator = eleven_client.text_to_speech.convert(
                text=input_text,
                voice_id="JBFqnCBsd6RMkjVDRZzb",  # George voice ID
                model_id="eleven_flash_v2_5"
            )
            
            audio_bytes = b"".join(audio_generator)
            
            st.write("☁️ Saving to cloud storage...")
            clean_filename = uploaded_file.name.replace(".pdf", ".mp3").replace(" ", "_")
            public_audio_url = upload_to_supabase_storage(audio_bytes, clean_filename)
            
            log_audiobook_to_db(uploaded_file.name, public_audio_url, len(audio_bytes))
            
            status.update(label="Complete!", state="complete", expanded=False)
        
        # Audio Player Card
        st.markdown('<div class="audio-card">', unsafe_allow_html=True)
        st.subheader("Synthesized Output")
        st.audio(public_audio_url, format="audio/mp3")
        st.markdown('</div>', unsafe_allow_html=True)