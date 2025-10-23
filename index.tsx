import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize GoogleGenAI outside the component to avoid re-creation on every render.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const App = () => {
    // State for form inputs, results, loading, and errors
    const [query, setQuery] = useState('cafeterías');
    const [city, setCity] = useState('Málaga');
    const [limit, setLimit] = useState(10);
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Function to generate a slug from the business name for the URL
    const slugify = (text: string) => text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text

    const handleSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setResults([]);

        // UPDATE: Modified prompt to request star rating and include it in the JSON output.
        const prompt = `Actúa como un agente de prospección local experto. Busca en Google Maps hasta ${limit} establecimientos del tipo "${query}" en la ciudad de ${city}, España, que explícitamente NO tengan un sitio web listado en su perfil de Google. Para cada establecimiento encontrado, extrae su nombre, dirección completa, número de teléfono (con prefijo +34 si es posible), el enlace directo de Google Maps y su calificación en estrellas (un número de 1 a 5). Devuelve los resultados únicamente como un array JSON válido. Cada objeto del array debe tener las siguientes claves: "nombre", "direccion", "telefono", "enlaceMaps", "email" (si está disponible) y "estrellas". No incluyas texto explicativo, solo el JSON.`;
        
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleMaps: {} }],
                },
            });

            let jsonString = response.text.trim();
            const jsonStartIndex = jsonString.indexOf('[');
            const jsonEndIndex = jsonString.lastIndexOf(']');

            if (jsonStartIndex === -1 || jsonEndIndex === -1) {
                throw new Error("No valid JSON array found in response.");
            }
            
            jsonString = jsonString.substring(jsonStartIndex, jsonEndIndex + 1);
            const parsedResults = JSON.parse(jsonString);
            
            const processedResults = parsedResults.map((business: any) => {
                const businessName = business.nombre || 'el establecimiento';
                const localSlug = slugify(businessName);

                return {
                    ...business,
                    estrellas: business.estrellas || 0, // Ensure stars field exists
                    email: business.email || 'No disponible',
                    asuntoCorreo: `Colaboración: Tu cafetería en la nueva GuíaDigital de Málaga`,
                    cuerpoCorreo: `Hola, ${businessName},

Somos el equipo de GuíaDigital Málaga. Estamos creando una guía exclusiva con las mejores cafeterías de la ciudad y nos encantaría incluir la vuestra.

Para ayudar a que más gente os descubra, os ofrecemos crear y mantener vuestra página web profesional (1 página, hosting incluido) sin coste alguno. A cambio, solo pedimos aparecer en nuestra guía.

¿Qué os parece la idea? Quedamos a la espera de vuestra respuesta.

Un saludo,
Equipo GuíaDigital Málaga`,
                    whatsapp: `¡Hola! 😊 Soy del equipo de GuíaDigital Málaga. ${businessName} nos encanta y queremos destacarlo en nuestra nueva guía. Para ayudaros a tener más visibilidad online, os regalamos una web profesional como esta: https://tuguiamalaga.com/${localSlug}. ¿Hablamos? ¡Es sin coste!`
                };
            })
            // UPDATE: Sort results by stars in ascending order.
            .sort((a: any, b: any) => (a.estrellas || 0) - (b.estrellas || 0));

            setResults(processedResults);

        } catch (err) {
            console.error("Error fetching data from Gemini API", err);
            setError("No se pudieron obtener los resultados. Es posible que no se hayan encontrado establecimientos que cumplan los criterios. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    }, [query, city, limit]);

    const exportToCsv = () => {
        if (results.length === 0) return;
        // UPDATE: Added "Estrellas" to CSV headers.
        const headers = ["Nombre", "Dirección", "Teléfono", "Email", "Enlace de Google Maps", "Estrellas", "AsuntoCorreo", "CuerpoCorreo", "WhatsApp"];
        const csvRows = [
            headers.join(','),
            ...results.map(row => {
                 const values = [
                    row.nombre,
                    row.direccion,
                    row.telefono,
                    row.email,
                    row.enlaceMaps,
                    row.estrellas, // UPDATE: Added stars value to CSV row.
                    row.asuntoCorreo,
                    row.cuerpoCorreo,
                    row.whatsapp
                ];
                // Escape commas and quotes in values
                return values.map(value => `"${(value || '').toString().replace(/"/g, '""')}"`).join(',');
            })
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'prospectos_cafeterias_malaga.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={styles.container}>
            <style>{globalStyles}</style>
            <header style={styles.header}>
                <h1 style={styles.title}>Agente de Prospección Local</h1>
                <p style={styles.subtitle}>Encuentra negocios locales sin sitio web y genera mensajes de contacto.</p>
            </header>

            <main style={styles.main}>
                <form onSubmit={handleSearch} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label htmlFor="query" style={styles.label}>Tipo de negocio</label>
                        <input type="text" id="query" value={query} onChange={(e) => setQuery(e.target.value)} style={styles.input} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="city" style={styles.label}>Ciudad</label>
                        <input type="text" id="city" value={city} onChange={(e) => setCity(e.target.value)} style={styles.input} />
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="limit" style={styles.label}>Nº de establecimientos</label>
                        <input type="number" id="limit" value={limit} min="1" max="50" onChange={(e) => setLimit(parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {isLoading ? 'Buscando...' : 'Buscar establecimientos'}
                    </button>
                </form>

                {isLoading && (
                    <div style={styles.loaderContainer}>
                        <div className="spinner"></div>
                        <p>Buscando en Google Maps y generando contenido...</p>
                    </div>
                )}
                
                {error && <p style={styles.error}>{error}</p>}

                {results.length > 0 && (
                    <section style={styles.resultsSection}>
                        <div style={styles.resultsHeader}>
                             <h2 style={styles.resultsTitle}>Resultados de la prospección</h2>
                             <button onClick={exportToCsv} style={styles.exportButton}>Exportar a CSV</button>
                        </div>
                        <div style={styles.tableContainer}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        {/* UPDATE: Added "Estrellas" column header */}
                                        <th style={styles.th}>Estrellas</th>
                                        <th style={styles.th}>Nombre</th>
                                        <th style={styles.th}>Dirección</th>
                                        <th style={styles.th}>Teléfono</th>
                                        <th style={styles.th}>Email</th>
                                        <th style={styles.th}>Maps</th>
                                        <th style={styles.th}>Asunto Correo</th>
                                        <th style={styles.th}>Cuerpo Correo</th>
                                        <th style={styles.th}>Mensaje WhatsApp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((item, index) => (
                                        <tr key={index} style={styles.tr}>
                                            {/* UPDATE: Added cell to display stars visually */}
                                            <td style={styles.tdStars}>{'★'.repeat(item.estrellas || 0)}{'☆'.repeat(5 - (item.estrellas || 0))}</td>
                                            <td style={styles.td}>{item.nombre}</td>
                                            <td style={styles.td}>{item.direccion}</td>
                                            <td style={styles.td}>{item.telefono}</td>
                                            <td style={styles.td}>{item.email}</td>
                                            <td style={styles.td}><a href={item.enlaceMaps} target="_blank" rel="noopener noreferrer">Ver en Maps</a></td>
                                            <td style={styles.td}><pre style={styles.pre}>{item.asuntoCorreo}</pre></td>
                                            <td style={styles.td}><pre style={styles.pre}>{item.cuerpoCorreo}</pre></td>
                                            <td style={styles.td}><pre style={styles.pre}>{item.whatsapp}</pre></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

// Styles
// UPDATE: Changed color scheme to black text on white background for better contrast.
const styles: { [key: string]: React.CSSProperties } = {
    container: { fontFamily: 'sans-serif', color: '#000000', backgroundColor: '#ffffff', minHeight: '100vh' },
    header: { backgroundColor: '#f8f9fa', padding: '2rem', borderBottom: '1px solid #dee2e6', textAlign: 'center' },
    title: { color: '#1a73e8', margin: '0 0 0.5rem 0', fontSize: '2.5rem' },
    subtitle: { margin: 0, color: '#333333', fontSize: '1.1rem' },
    main: { padding: '2rem', maxWidth: '1400px', margin: '0 auto' },
    form: { display: 'flex', gap: '1rem', alignItems: 'flex-end', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '2rem', flexWrap: 'wrap' },
    formGroup: { display: 'flex', flexDirection: 'column', flex: '1 1 200px' },
    label: { marginBottom: '0.5rem', fontWeight: 'bold', color: '#333333' },
    input: { padding: '0.8rem', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '1rem', backgroundColor: '#fff', color: '#000000' },
    button: { padding: '0.8rem 1.5rem', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', transition: 'background-color 0.3s' },
    loaderContainer: { textAlign: 'center', padding: '2rem', color: '#333333' },
    error: { color: '#d93025', textAlign: 'center', backgroundColor: '#f8d7da', padding: '1rem', borderRadius: '8px' },
    resultsSection: { backgroundColor: '#ffffff', padding: '2rem', borderRadius: '8px', border: '1px solid #dee2e6' },
    resultsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'},
    resultsTitle: { margin: 0, color: '#1a73e8' },
    exportButton: { padding: '0.6rem 1.2rem', backgroundColor: '#188038', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' },
    tableContainer: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#e8f0fe', padding: '1rem', textAlign: 'left', borderBottom: '2px solid #1a73e8', color: '#1a73e8' },
    tr: { borderBottom: '1px solid #dee2e6' },
    td: { padding: '1rem', verticalAlign: 'top', minWidth: '150px' },
    tdStars: { padding: '1rem', verticalAlign: 'top', fontSize: '1.2rem', color: '#000000', minWidth: '120px' },
    pre: { whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: '#000000' },
};

const globalStyles = `
body {
    margin: 0;
    color: black;

}
input:focus {
    outline: 2px solid #1a73e8;
    border-color: #1a73e8;
}
button:hover {
    background-color: #185abc;
}
button:disabled {
    background-color: #9e9e9e;
    cursor: not-allowed;
}
.spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: #1a73e8;
    animation: spin 1s ease infinite;
    margin: 0 auto 1rem;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
a {
    color: #1a73e8;
    text-decoration: none;
}
a:hover {
    text-decoration: underline;
}
`;

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}
