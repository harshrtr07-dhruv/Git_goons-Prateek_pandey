import fitz
import requests

# Create a valid PDF
doc = fitz.open()
page = doc.new_page()
page.insert_text((50, 50), "This is a valid PDF document. We propose a very simple machine learning model. It is defined as a test. The results outperform the baseline. However, it has some limitations. Concept mapping is important.")
doc.save("test_valid.pdf")
doc.close()

# Upload the PDF via requests to the Node server
with open("test_valid.pdf", "rb") as f:
    files = {'pdf': ('test_valid.pdf', f, 'application/pdf')}
    res = requests.post("http://localhost:3000/api/upload", files=files)
    
print("Status:", res.status_code)
print("Response:", res.text)
