
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-BO', {
        style: 'currency',
        currency: 'BOB',
        minimumFractionDigits: 2
    }).format(amount || 0)
}

export const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}
