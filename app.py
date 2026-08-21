import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# 1. Cargamos las variables secretas del archivo .env
load_dotenv()
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

app = Flask(__name__)

# 2. CORS: Ahora lo dejamos abierto a todo por defecto, pero cuando 
# tengas tu dominio oficial (ej: www.locobarber.com), cambias esta línea por:
# CORS(app, origins=["https://www.locobarber.com"])
CORS(app)

# 3. Configuramos el limitador de peticiones (Rate Limiting)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

def enviar_mensaje_telegram(mensaje):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": mensaje,
        "parse_mode": "Markdown"
    }
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print("Error enviando Telegram:", e)

# 4. Ruta para recibir turnos con límite estricto de seguridad
@app.route('/api/reservar', methods=['POST'])
@limiter.limit("3 per minute")  # MÁXIMO 3 intentos por minuto por usuario
def recibir_reserva():
    datos = request.json
    
    # 5. Sanitización: Cortamos los textos para que no nos envíen datos gigantes 
    # y usamos .strip() para sacar espacios vacíos.
    nombre = str(datos.get('nombre', '')).strip()[:50]
    telefono = str(datos.get('telefono', '')).strip()[:20]
    servicio = str(datos.get('servicio', '')).strip()[:50]
    fecha = str(datos.get('fecha', '')).strip()[:15]
    hora = str(datos.get('hora', '')).strip()[:10]
    precio = str(datos.get('precio', '')).strip()[:20]
    
    # Verificamos que los campos obligatorios no estén vacíos
    if not nombre or not telefono or not servicio:
        return jsonify({"error": "Faltan datos obligatorios"}), 400
    
    mensaje_celular = f"""💈 *NUEVO TURNO - LOCOBARBER* 💈

👤 *Cliente:* {nombre}
📱 *Tel:* {telefono}
✂️ *Servicio:* {servicio} ({precio})
📅 *Cuándo:* {fecha} a las {hora}
"""
    
    print(f"Turno procesado con seguridad para: {nombre}")
    
    enviar_mensaje_telegram(mensaje_celular)
    
    return jsonify({
        "mensaje": "Turno procesado correctamente",
        "status": "ok"
    }), 200

if __name__ == '__main__':
    # 6. Modo debug apagado (False) para que sea seguro en internet
    app.run(debug=False, port=5000)