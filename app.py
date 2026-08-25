import os
import sqlite3
import re
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import requests
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Cargamos las variables secretas del archivo .env
load_dotenv()
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
# Contraseña secreta para liberar turnos vos mismo (podés cambiarla)
CLAVE_ADMIN = "loco123"

app = Flask(__name__)
CORS(app)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

# --- CONFIGURACIÓN DE SEGURIDAD EXTRA ---
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Validadores básicos usando expresiones regulares
def validar_fecha(fecha):
    return bool(re.match(r'^\d{4}-\d{2}-\d{2}$', str(fecha)))

def validar_hora(hora):
    return bool(re.match(r'^\d{2}:\d{2}$', str(hora)))

# --- 1. INICIALIZAR BASE DE DATOS ---
def iniciar_db():
    conexion = sqlite3.connect('turnos.db')
    cursor = conexion.cursor()
    # Creamos la tabla si no existe
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reservas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            telefono TEXT,
            servicio TEXT,
            fecha TEXT,
            hora TEXT,
            precio TEXT
        )
    ''')
    conexion.commit()
    conexion.close()

# Ejecutamos la función al arrancar
iniciar_db()


def enviar_mensaje_telegram(mensaje):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return # Si no hay variables de entorno, no intentar enviar
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": mensaje,
        "parse_mode": "Markdown"
    }
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        print("Error enviando Telegram:", e)


# --- 2. RUTA PARA CONSULTAR HORARIOS OCUPADOS ---
@app.route('/api/ocupados', methods=['GET'])
@limiter.limit("20 per minute")
def horarios_ocupados():
    fecha = request.args.get('fecha')
    if not fecha or not validar_fecha(fecha):
        return jsonify({"ocupados": []})

    conexion = sqlite3.connect('turnos.db')
    cursor = conexion.cursor()
    cursor.execute('SELECT hora FROM reservas WHERE fecha = ?', (fecha,))
    filas = cursor.fetchall()
    conexion.close()

    ocupados = [fila[0] for fila in filas]
    
    return jsonify({"ocupados": ocupados})


# --- 3. RUTA PARA RESERVAR (AHORA GUARDA EN LA BASE) ---
@app.route('/api/reservar', methods=['POST'])
@limiter.limit("3 per minute")
def recibir_reserva():
    datos = request.json
    if not datos:
        return jsonify({"error": "No se enviaron datos"}), 400
    
    nombre = str(datos.get('nombre', '')).strip()[:50]
    telefono = str(datos.get('telefono', '')).strip()[:20]
    servicio = str(datos.get('servicio', '')).strip()[:50]
    fecha = str(datos.get('fecha', '')).strip()[:15]
    hora = str(datos.get('hora', '')).strip()[:10]
    precio = str(datos.get('precio', '')).strip()[:20]
    
    if not nombre or not telefono or not servicio or not fecha or not hora:
        return jsonify({"error": "Faltan datos obligatorios"}), 400
        
    if not validar_fecha(fecha) or not validar_hora(hora):
        return jsonify({"error": "Formato de fecha u hora inválido"}), 400
    
    # Sanitización básica HTML
    nombre = nombre.replace('<', '&lt;').replace('>', '&gt;')
    telefono = re.sub(r'[^\d\+\s\-]', '', telefono) # Permitir solo números y símbolos telefónicos
    
    # Verificamos que el turno no se haya ocupado
    conexion = sqlite3.connect('turnos.db')
    cursor = conexion.cursor()
    cursor.execute('SELECT id FROM reservas WHERE fecha = ? AND hora = ?', (fecha, hora))
    if cursor.fetchone():
        conexion.close()
        return jsonify({"error": "Ese horario ya fue reservado"}), 400

    # Si está libre, lo guardamos en la base de datos
    cursor.execute('''
        INSERT INTO reservas (nombre, telefono, servicio, fecha, hora, precio)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (nombre, telefono, servicio, fecha, hora, precio))
    conexion.commit()
    conexion.close()
    
    mensaje_celular = f"""💈 *NUEVO TURNO - LOCOBARBER* 💈

👤 *Cliente:* {nombre}
📱 *Tel:* {telefono}
✂️ *Servicio:* {servicio} ({precio})
📅 *Cuándo:* {fecha} a las {hora}
"""
    enviar_mensaje_telegram(mensaje_celular)
    
    return jsonify({
        "mensaje": "Turno procesado y guardado",
        "status": "ok"
    }), 200


# --- 4. RUTA SECRETA PARA LIBERAR UN TURNO CANCELADO ---
@app.route('/api/liberar', methods=['GET'])
@limiter.limit("10 per minute")
def liberar_turno():
    fecha = request.args.get('fecha')
    hora = request.args.get('hora')
    clave = request.args.get('clave')

    if clave != CLAVE_ADMIN:
        return "Clave incorrecta", 403

    if not fecha or not hora or not validar_fecha(fecha) or not validar_hora(hora):
        return "Faltan datos o formato inválido", 400

    conexion = sqlite3.connect('turnos.db')
    cursor = conexion.cursor()
    cursor.execute('DELETE FROM reservas WHERE fecha = ? AND hora = ?', (fecha, hora))
    conexion.commit()
    conexion.close()

    return f"✅ El turno del {fecha} a las {hora} fue eliminado. Ya vuelve a aparecer en la web."


# --- 5. RUTA SECRETA PARA BLOQUEAR/OCUPAR UN TURNO MANUALMENTE ---
@app.route('/api/ocupar', methods=['GET'])
@limiter.limit("10 per minute")
def ocupar_turno():
    fecha = request.args.get('fecha')
    hora = request.args.get('hora')
    clave = request.args.get('clave')

    if clave != CLAVE_ADMIN:
        return "Clave incorrecta", 403

    if not fecha or not hora or not validar_fecha(fecha) or not validar_hora(hora):
        return "Faltan datos o formato inválido", 400

    conexion = sqlite3.connect('turnos.db')
    cursor = conexion.cursor()
    
    # Chequeamos si ya está ocupado
    cursor.execute('SELECT id FROM reservas WHERE fecha = ? AND hora = ?', (fecha, hora))
    if cursor.fetchone():
        conexion.close()
        return f"⚠️ El turno del {fecha} a las {hora} ya estaba ocupado."

    # Lo bloqueamos con datos genéricos
    cursor.execute('''
        INSERT INTO reservas (nombre, telefono, servicio, fecha, hora, precio)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ("BLOQUEADO (MANUAL)", "-", "Reserva manual/WhatsApp", fecha, hora, "-"))
    conexion.commit()
    conexion.close()

    return f"🔒 El turno del {fecha} a las {hora} fue bloqueado correctamente. Ya no aparece en la web."


if __name__ == '__main__':
    app.run(debug=False, port=5000)