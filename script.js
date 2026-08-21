// Locobarber Shop — flujo de reserva de turnos
document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Video de fondo: pausar si el usuario prefiere menos movimiento ---------- */
    const video = document.getElementById('logoVideo');
    const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (video) {
        if (prefiereMenosMovimiento) {
            video.pause();
        }
        // Si el archivo de video no existe o falla, ocultarlo y dejar el fondo sólido.
        video.addEventListener('error', () => {
            video.style.display = 'none';
        });
    }

    /* ---------- Flujo de turnos ---------- */
    const formulario = document.getElementById('formulario');
    if (!formulario) return;

    const chips = document.querySelectorAll('.chip');
    const servicioInput = document.getElementById('servicio');
    const nombreInput = document.getElementById('nombre');
    const telefonoInput = document.getElementById('telefono');
    const fechaInput = document.getElementById('fecha');
    const horaInput = document.getElementById('hora');
    const btnReservar = document.getElementById('btnReservar');

    const resServicio = document.getElementById('resServicio');
    const resFecha = document.getElementById('resFecha');
    const resHora = document.getElementById('resHora');
    const resPrecio = document.getElementById('resPrecio');

    const turnosWrap = document.getElementById('turnosWrap');
    const confirmacion = document.getElementById('confirmacion');
    const confirmacionTexto = document.getElementById('confirmacionTexto');
    const btnNuevo = document.getElementById('btnNuevo');

    // No dejar elegir una fecha anterior a hoy.
    const hoy = new Date().toISOString().split('T')[0];
    fechaInput.setAttribute('min', hoy);

    let precioSeleccionado = '';

    // Selección de servicio mediante chips.
    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            chips.forEach((c) => c.classList.remove('activo'));
            chip.classList.add('activo');

            const valor = chip.dataset.valor;
            precioSeleccionado = chip.dataset.precio;

            servicioInput.value = valor;
            resServicio.textContent = valor;
            resPrecio.textContent = precioSeleccionado;

            validar();
        });
    });

    const formatearFecha = (valor) => {
        if (!valor) return '—';
        const [anio, mes, dia] = valor.split('-');
        return `${dia}/${mes}/${anio}`;
    };

    fechaInput.addEventListener('input', () => {
        resFecha.textContent = formatearFecha(fechaInput.value);
        validar();
    });

    horaInput.addEventListener('input', () => {
        resHora.textContent = horaInput.value || '—';
        validar();
    });

    nombreInput.addEventListener('input', validar);
    telefonoInput.addEventListener('input', validar);

    function validar() {
        const listo =
            servicioInput.value.trim() !== '' &&
            fechaInput.value.trim() !== '' &&
            horaInput.value.trim() !== '' &&
            nombreInput.value.trim() !== '' &&
            telefonoInput.value.trim() !== '';

        btnReservar.disabled = !listo;
        return listo;
    }

    // --- CONEXIÓN CON PYTHON ---
    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (!validar()) return;

        const datosReserva = {
            nombre: nombreInput.value.trim(),
            telefono: telefonoInput.value.trim(),
            servicio: servicioInput.value,
            fecha: fechaInput.value,
            hora: horaInput.value,
            precio: precioSeleccionado
        };

        const textoOriginal = btnReservar.textContent;
        btnReservar.textContent = 'Enviando...';
        btnReservar.disabled = true;

        try {
           const respuesta = await fetch('https://pagina-de-prueba-locobarber.onrender.com/api/reservar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datosReserva)
            });

            if (respuesta.ok) {
                confirmacionTexto.textContent =
                    `¡Listo, ${datosReserva.nombre}! Tu turno de "${datosReserva.servicio}" quedó reservado para el ` +
                    `${formatearFecha(datosReserva.fecha)} a las ${datosReserva.hora} (${datosReserva.precio}). ` +
                    `Te vamos a escribir al ${datosReserva.telefono} para confirmar.`;

                turnosWrap.hidden = true;
                formulario.hidden = true;
                confirmacion.hidden = false;
                confirmacion.scrollIntoView({ behavior: prefiereMenosMovimiento ? 'auto' : 'smooth', block: 'center' });
            } else {
                alert("Hubo un problema al registrar el turno en el servidor.");
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            alert("No nos pudimos conectar con el servidor. Intenta nuevamente.");
        } finally {
            btnReservar.textContent = textoOriginal;
            btnReservar.disabled = false;
        }
    });

    // --- RESETEO DEL FORMULARIO ---
    btnNuevo.addEventListener('click', () => {
        formulario.reset();
        chips.forEach((c) => c.classList.remove('activo'));
        resServicio.textContent = '—';
        resFecha.textContent = '—';
        resHora.textContent = '—';
        resPrecio.textContent = '—';
        btnReservar.disabled = true;

        confirmacion.hidden = true;
        turnosWrap.hidden = false;
        formulario.hidden = false;
        turnosWrap.scrollIntoView({ behavior: prefiereMenosMovimiento ? 'auto' : 'smooth', block: 'center' });
    });
});