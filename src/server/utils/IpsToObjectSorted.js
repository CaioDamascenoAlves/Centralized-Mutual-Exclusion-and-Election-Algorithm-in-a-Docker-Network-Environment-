function ipsToObjectSorted(ips) {

    let objeto;

    if (typeof ips === 'string') {

        objeto = {};
        ips.split(',').forEach(ip => {
            const ultimoSegmento = ip.trim().split('.').pop();
            objeto[parseInt(ultimoSegmento) + 3000] = ip.trim();
        });
        
    } else if (typeof ips === 'object' && ips !== null) {
        objeto = ips;
    }

    // Ordena o objeto pela chave
    return Object.fromEntries(
        Object.entries(objeto).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    );
}

module.exports = ipsToObjectSorted;
