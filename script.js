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

    /* ---------- Botón CTA del hero: animación de onda al tocar ---------- */
    const btnHero = document.querySelector('.btn-hero');
    if (btnHero) {
        btnHero.addEventListener('click', () => {
            btnHero.classList.remove('clic');
            // Forzar reflow para poder reiniciar la animación en clics seguidos.
            void btnHero.offsetWidth;
            btnHero.classList.add('clic');
        });
        btnHero.addEventListener('animationend', () => {
            btnHero.classList.remove('clic');
        });
    }

    /* ---------- Tarjetas de servicios: onda al tocar + redirigen a turnos con el servicio preseleccionado ---------- */
    const botonesServicio = document.querySelectorAll('.servicios[data-servicio]');
    const seccionTurnos = document.getElementById('turnos');

    botonesServicio.forEach((boton) => {
        boton.addEventListener('click', () => {
            boton.classList.remove('clic');
            void boton.offsetWidth;
            boton.classList.add('clic');

            const chipCoincidente = document.querySelector(`.chip[data-valor="${boton.dataset.servicio}"]`);
            if (chipCoincidente) {
                chipCoincidente.click();
            }

            if (seccionTurnos) {
                seccionTurnos.scrollIntoView({
                    behavior: prefiereMenosMovimiento ? 'auto' : 'smooth',
                    block: 'start',
                });
            }
        });

        boton.addEventListener('animationend', () => {
            boton.classList.remove('clic');
        });
    });

    /* ---------- Flujo de turnos ---------- */
    const formulario = document.getElementById('formulario');
    if (!formulario) return;

    const chips = document.querySelectorAll('.chip:not(.chip-hora)');
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

    // Selección de hora mediante chips
    const chipsHora = document.querySelectorAll('.chip-hora');
    
    // Validación de fecha y consulta de horarios disponibles al servidor
    fechaInput.addEventListener('input', async () => {
        if (fechaInput.value) {
            // Le agregamos T00:00:00 para evitar desfasajes de zona horaria
            const fechaSeleccionada = new Date(fechaInput.value + 'T00:00:00');
            if (fechaSeleccionada.getDay() === 0) { // El 0 es Domingo
                alert('Los domingos estamos cerrados. Por favor, elegí un día de lunes a sábado.');
                fechaInput.value = '';
                resFecha.textContent = '—';
                
                // Mostrar todos los botones de nuevo por si se borra la fecha
                chipsHora.forEach(chip => chip.style.display = 'flex');
            } else {
                resFecha.textContent = formatearFecha(fechaInput.value);

                // --- MAGIA CON PYTHON: OCULTAR BOTONES OCUPADOS ---
                // 1. Mostrar todos los botones primero (por si había ocultado los de otra fecha)
                chipsHora.forEach(chip => {
                    chip.style.display = 'flex';
                    chip.classList.remove('activo'); // Despinta si había uno elegido
                });
                // Reseteamos el valor de la hora elegida
                horaInput.value = '';
                resHora.textContent = '—';

                try {
                    // 2. Le preguntamos a Python qué horas están ocupadas para esta fecha
                    const respuesta = await fetch(`https://pagina-de-prueba-locobarber.onrender.com/api/ocupados?fecha=${fechaInput.value}`);
                    
                    if (respuesta.ok) {
                        const datos = await respuesta.json(); // Python nos devolverá algo como { ocupados: ["08:00", "15:00"] }
                        const horasOcupadas = datos.ocupados || [];

                        // 3. Ocultamos los botones que coincidan con la lista de Python
                        chipsHora.forEach(chip => {
                            if (horasOcupadas.includes(chip.dataset.hora)) {
                                chip.style.display = 'none'; // Desaparece el botón
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error al consultar horarios al servidor:", error);
                }
            }
        } else {
            resFecha.textContent = '—';
            // Si borra la fecha, volvemos a mostrar todos los horarios
            chipsHora.forEach(chip => chip.style.display = 'flex');
        }
        validar();
    });

    chipsHora.forEach((chip) => {
        chip.addEventListener('click', () => {
            // Despintar todos y pintar el seleccionado
            chipsHora.forEach((c) => c.classList.remove('activo'));
            chip.classList.add('activo');

            // Guardar el valor en el input oculto y en el resumen
            const valorHora = chip.dataset.hora;
            horaInput.value = valorHora;
            resHora.textContent = valorHora;

            validar();
        });
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
                const dataError = await respuesta.json();
                alert(dataError.error || "Hubo un problema al registrar el turno en el servidor.");
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
        chipsHora.forEach((c) => {
            c.classList.remove('activo');
            c.style.display = 'flex'; // Volver a mostrar todos los horarios
        });
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

    /* ---------- Scroll Reveal con IntersectionObserver ---------- */
    if ('IntersectionObserver' in window) {
        const observerOpciones = {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px"
        };

        const observer = new IntersectionObserver((entradas) => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add('visible');
                    // Opcional: dejar de observar si solo queremos que se anime una vez al entrar
                    observer.unobserve(entrada.target);
                }
            });
        }, observerOpciones);

        const elementosReveal = document.querySelectorAll('.reveal');
        elementosReveal.forEach(el => observer.observe(el));
    } else {
        // Fallback si no soporta IntersectionObserver
        const elementosReveal = document.querySelectorAll('.reveal');
        elementosReveal.forEach(el => el.classList.add('visible'));
    }
});