// ========================================
// CHECKOUT LOGIC - JORNADA R3 (HOTMART STYLE)
// ========================================

var VALID_COUPONS = ['SELECIONADON1', 'SELECIONADON2', 'SELECIONADON3', 'SELECIONADON4', 'SELECIONADON5', 'SELECIONADON6', 'SELECIONADON7'];
var ORIGINAL_PRICE = 997.00;
var DISCOUNT_PERCENTAGE = 0.90;

var couponApplied = false;
var formData = {};
var pixCode = '';
var pixQRCodeUrl = '';
var pollingInterval = null;

// ========================================
// MASCARAS E FORMATACAO
// ========================================

function maskCPF(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
}

function onlyNumbers(value) {
    return value.replace(/\D/g, '');
}

// ========================================
// VALIDACOES
// ========================================

function validateName(name) {
    return name.trim().length >= 3;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCPF(cpf) {
    cpf = onlyNumbers(cpf);
    if (cpf.length !== 11) return false;

    var invalidCPFs = [
        '00000000000', '11111111111', '22222222222',
        '33333333333', '44444444444', '55555555555',
        '66666666666', '77777777777', '88888888888',
        '99999999999'
    ];
    if (invalidCPFs.indexOf(cpf) !== -1) return false;

    var sum = 0;
    for (var i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    var remainder = 11 - (sum % 11);
    var digit1 = remainder >= 10 ? 0 : remainder;
    if (digit1 !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (var i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    var digit2 = remainder >= 10 ? 0 : remainder;
    if (digit2 !== parseInt(cpf.charAt(10))) return false;

    return true;
}

function validatePhone(phone) {
    var numbers = onlyNumbers(phone);
    return numbers.length >= 10 && numbers.length <= 11;
}

function formatPhoneForAPI(phone) {
    return '55' + onlyNumbers(phone);
}

function toCents(value) {
    return Math.round(value * 100);
}

// ========================================
// UI HELPERS
// ========================================

function showError(fieldId) {
    var input = document.getElementById(fieldId);
    var error = document.getElementById(fieldId + '-error');
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) input.classList.add('error');
    if (wrapper) wrapper.classList.add('error');
    if (error) error.classList.add('show');
}

function clearError(fieldId) {
    var input = document.getElementById(fieldId);
    var error = document.getElementById(fieldId + '-error');
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) input.classList.remove('error');
    if (wrapper) wrapper.classList.remove('error');
    if (error) error.classList.remove('show');
}

function markValid(fieldId) {
    var input = document.getElementById(fieldId);
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) { input.classList.remove('error'); input.classList.add('valid'); }
    if (wrapper) { wrapper.classList.remove('error'); wrapper.classList.add('valid'); }
}

function clearValid(fieldId) {
    var input = document.getElementById(fieldId);
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) input.classList.remove('valid');
    if (wrapper) wrapper.classList.remove('valid');
}

// ========================================
// COUPON SYSTEM
// ========================================

function formatBRL(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function applyCoupon(code) {
    if (VALID_COUPONS.indexOf(code.toUpperCase().trim()) !== -1) {
        var discount = ORIGINAL_PRICE * DISCOUNT_PERCENTAGE;
        var finalPrice = ORIGINAL_PRICE - discount;

        couponApplied = true;
        formData.valorFinal = finalPrice;
        formData.cupom = code.toUpperCase();

        // Update all price displays
        var detailsPrice = document.getElementById('details-price');
        if (detailsPrice) {
            detailsPrice.textContent = formatBRL(finalPrice);
        }

        var headerPrice = document.querySelector('.product-infos .price');
        if (headerPrice) {
            headerPrice.innerHTML = '<span style="text-decoration:line-through;color:var(--gray-400);font-size:.85rem;font-weight:400;">' + formatBRL(ORIGINAL_PRICE) + '</span><br>' + formatBRL(finalPrice);
        }

        // Show discount summary modal
        showDiscountModal(code.toUpperCase(), discount, finalPrice);

        return true;
    }
    return false;
}

function showDiscountModal(code, discount, finalPrice) {
    var modal = document.getElementById('discount-modal');
    if (!modal) return;

    document.getElementById('dm-code').textContent = code;
    document.getElementById('dm-original').textContent = formatBRL(ORIGINAL_PRICE);
    document.getElementById('dm-discount').textContent = '- ' + formatBRL(discount);
    document.getElementById('dm-percent').textContent = Math.round(DISCOUNT_PERCENTAGE * 100) + '%';
    document.getElementById('dm-final').textContent = formatBRL(finalPrice);

    modal.classList.add('active');

    // Auto-close after 4 seconds
    setTimeout(function() {
        modal.classList.remove('active');
    }, 5000);
}

// ========================================
// MAIN LOGIC
// ========================================

document.addEventListener('DOMContentLoaded', function() {

    var emailInput = document.getElementById('email');
    var emailConfirmInput = document.getElementById('email-confirm');
    var nomeInput = document.getElementById('nome');
    var cpfInput = document.getElementById('cpf');
    var telefoneInput = document.getElementById('telefone');

    var pixCopyBtn = document.getElementById('pix-copy-btn');
    var pixQrBtn = document.getElementById('pix-qr-btn');

    // Coupon toggle
    var couponToggle = document.getElementById('coupon-toggle');
    var couponCollapse = document.getElementById('coupon-collapse');
    var couponField = document.getElementById('coupon-field');
    var applyBtn = document.getElementById('apply-btn');
    var couponHint = document.getElementById('coupon-hint');

    if (couponToggle) {
        couponToggle.addEventListener('click', function() {
            if (couponApplied) return;
            couponToggle.classList.toggle('open');
            couponCollapse.classList.toggle('open');
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            var code = couponField.value.trim();
            if (!code) return;

            if (applyCoupon(code)) {
                couponField.classList.add('valid');
                couponField.classList.remove('invalid');
                couponHint.textContent = 'Cupom "' + code.toUpperCase() + '" aplicado com sucesso!';
                couponHint.className = 'coupon-hint success';
                applyBtn.classList.add('success');
                couponToggle.classList.remove('open');
                couponToggle.classList.add('applied');
                couponToggle.innerHTML = '<i class="fa-solid fa-check" style="color:var(--green);margin-right:8px;"></i> Cupom aplicado';
                couponCollapse.classList.remove('open');
            } else {
                couponField.classList.add('invalid');
                couponField.classList.remove('valid');
                couponHint.textContent = 'Codigo invalido. Tente novamente.';
                couponHint.className = 'coupon-hint error';
            }
        });

        couponField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyBtn.click();
        });
    }

    // Masks
    cpfInput.addEventListener('input', function(e) {
        e.target.value = maskCPF(e.target.value);
        if (validateCPF(e.target.value)) { markValid('cpf'); clearError('cpf'); }
        else { clearValid('cpf'); clearError('cpf'); }
    });

    telefoneInput.addEventListener('input', function(e) {
        e.target.value = maskPhone(e.target.value);
        if (validatePhone(e.target.value)) { markValid('telefone'); clearError('telefone'); }
        else { clearValid('telefone'); clearError('telefone'); }
    });

    // Real-time validation
    emailInput.addEventListener('input', function() {
        if (validateEmail(emailInput.value)) { markValid('email'); clearError('email'); }
        else { clearValid('email'); clearError('email'); }
    });

    emailInput.addEventListener('blur', function() {
        if (emailInput.value && !validateEmail(emailInput.value)) showError('email');
    });

    emailConfirmInput.addEventListener('input', function() {
        if (emailConfirmInput.value === emailInput.value && validateEmail(emailConfirmInput.value)) {
            markValid('email-confirm'); clearError('email-confirm');
        } else {
            clearValid('email-confirm'); clearError('email-confirm');
        }
    });

    emailConfirmInput.addEventListener('blur', function() {
        if (emailConfirmInput.value && emailConfirmInput.value !== emailInput.value) showError('email-confirm');
    });

    nomeInput.addEventListener('input', function() {
        if (validateName(nomeInput.value)) { markValid('nome'); clearError('nome'); }
        else { clearValid('nome'); clearError('nome'); }
    });

    nomeInput.addEventListener('blur', function() {
        if (nomeInput.value && !validateName(nomeInput.value)) showError('nome');
    });

    cpfInput.addEventListener('blur', function() {
        if (cpfInput.value && !validateCPF(cpfInput.value)) showError('cpf');
    });

    telefoneInput.addEventListener('blur', function() {
        if (telefoneInput.value && !validatePhone(telefoneInput.value)) showError('telefone');
    });

    // ========================================
    // PIX BUTTONS
    // ========================================

    function validateForm() {
        var hasError = false;

        if (!validateEmail(emailInput.value)) { showError('email'); hasError = true; }
        if (!emailConfirmInput.value || emailConfirmInput.value !== emailInput.value) { showError('email-confirm'); hasError = true; }
        if (!validateName(nomeInput.value)) { showError('nome'); hasError = true; }
        if (!validateCPF(cpfInput.value)) { showError('cpf'); hasError = true; }
        if (!validatePhone(telefoneInput.value)) { showError('telefone'); hasError = true; }

        return !hasError;
    }

    function collectFormData() {
        formData.nome = nomeInput.value.trim();
        formData.email = emailInput.value.trim();
        formData.cpf = cpfInput.value;
        formData.telefone = telefoneInput.value;
        formData.nomeCompleto = nomeInput.value.trim();
        formData.cpfFinal = cpfInput.value;
    }

    var pixGenerateBtn = document.getElementById('pix-generate-btn');

    // Generate PIX button — validates form, shows coupon popup, then generates
    pixGenerateBtn.addEventListener('click', function() {
        if (!validateForm()) return;

        if (!couponApplied) {
            showCouponPopup('generate');
            return;
        }

        collectFormData();
        generatePix('generate');
    });

    // Copy/QR buttons — only work after PIX is generated
    pixCopyBtn.addEventListener('click', function() {
        if (pixCode) copyPixCode();
    });

    pixQrBtn.addEventListener('click', function() {
        if (pixQRCodeUrl) showQRModal();
    });

    // ========================================
    // COUPON POPUP
    // ========================================

    var couponOverlay = document.getElementById('coupon-overlay');
    var popupInput = document.getElementById('popup-coupon-input');
    var popupApplyBtn = document.getElementById('popup-apply-btn');
    var popupSkipBtn = document.getElementById('popup-skip-btn');
    var popupMessage = document.getElementById('popup-message');
    var pendingAction = null;

    function showCouponPopup(action) {
        pendingAction = action;
        popupInput.value = '';
        popupInput.classList.remove('valid', 'invalid');
        popupMessage.textContent = '';
        popupMessage.className = 'popup-message';
        couponOverlay.classList.add('active');
        setTimeout(function() { popupInput.focus(); }, 300);
    }

    popupApplyBtn.addEventListener('click', function() {
        var code = popupInput.value.trim();
        if (!code) return;

        if (applyCoupon(code)) {
            popupInput.classList.add('valid');
            popupMessage.textContent = 'Cupom aplicado com sucesso!';
            popupMessage.className = 'popup-message success';

            // Update inline coupon UI too
            if (couponToggle) {
                couponToggle.classList.remove('open');
                couponToggle.classList.add('applied');
                couponToggle.innerHTML = '<i class="fa-solid fa-check" style="color:var(--green);margin-right:8px;"></i> Cupom aplicado';
                couponCollapse.classList.remove('open');
            }

            setTimeout(function() {
                couponOverlay.classList.remove('active');
                collectFormData();
                generatePix(pendingAction);
            }, 800);
        } else {
            popupInput.classList.add('invalid');
            popupMessage.textContent = 'Codigo invalido. Tente novamente.';
            popupMessage.className = 'popup-message error';
        }
    });

    popupInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') popupApplyBtn.click();
    });

    popupSkipBtn.addEventListener('click', function() {
        couponOverlay.classList.remove('active');
    });

    couponOverlay.addEventListener('click', function(e) {
        if (e.target === couponOverlay) couponOverlay.classList.remove('active');
    });

    // ========================================
    // PIX API
    // ========================================

    function generatePix(action) {
        var payload = {
            amount: toCents(formData.valorFinal || ORIGINAL_PRICE),
            customer: {
                name: formData.nomeCompleto,
                email: formData.email,
                phone: formatPhoneForAPI(formData.telefone),
                document: onlyNumbers(formData.cpfFinal)
            },
            items: [{
                name: 'Jornada R³: reflita, rode, refine',
                quantity: 1,
                unit_price: toCents(formData.valorFinal || ORIGINAL_PRICE)
            }]
        };

        console.log('Enviando dados para API:', payload);

        // Show loading on generate button
        pixGenerateBtn.disabled = true;
        pixGenerateBtn.innerHTML = '<span class="spinner"></span> Gerando PIX...';

        fetch('https://conversa-luizinha.blog/api/pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            if (!response.ok) throw new Error('Erro HTTP: ' + response.status);
            return response.json();
        })
        .then(function(data) {
            console.log('Resposta da API:', data);

            pixCode = data.pix.qrcode;
            pixQRCodeUrl = data.pix.qrcode_url || ('https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodeURIComponent(pixCode));
            formData.transactionId = data.id;
            formData.expiresAt = data.expiresAt;

            // Hide generate button, show copy/QR buttons
            pixGenerateBtn.style.display = 'none';
            pixCopyBtn.style.display = '';
            pixQrBtn.style.display = '';

            startPaymentPolling();
        })
        .catch(function(error) {
            console.error('Erro ao gerar PIX:', error);
            pixGenerateBtn.disabled = false;
            pixGenerateBtn.innerHTML = 'Gerar codigo Pix';
            alert('Erro ao gerar codigo PIX. Por favor, tente novamente.');
        });
    }

    // ========================================
    // COPY PIX CODE
    // ========================================

    function copyPixCode() {
        navigator.clipboard.writeText(pixCode).then(function() {
            pixCopyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Codigo copiado!';
            pixCopyBtn.style.background = '#006e2f';

            setTimeout(function() {
                pixCopyBtn.innerHTML = 'Copiar codigo Pix';
                pixCopyBtn.style.background = '#009d43';
            }, 2500);
        }).catch(function() {
            alert('Erro ao copiar. Por favor, copie manualmente.');
        });
    }

    // ========================================
    // QR CODE MODAL
    // ========================================

    var qrOverlay = document.getElementById('qr-overlay');
    var qrImg = document.getElementById('qr-code-img');
    var qrCloseBtn = document.getElementById('qr-close-btn');

    function showQRModal() {
        qrImg.src = pixQRCodeUrl;
        qrOverlay.classList.add('show');
    }

    qrCloseBtn.addEventListener('click', function() {
        qrOverlay.classList.remove('show');
    });

    qrOverlay.addEventListener('click', function(e) {
        if (e.target === qrOverlay) qrOverlay.classList.remove('show');
    });

    // ========================================
    // PAYMENT POLLING
    // ========================================

    function startPaymentPolling() {
        console.log('Iniciando polling de pagamento...');

        if (pollingInterval) clearInterval(pollingInterval);

        pollingInterval = setInterval(function() {
            fetch('https://conversa-luizinha.blog/api/check-payment?transactionId=' + formData.transactionId)
            .then(function(response) {
                if (!response.ok) throw new Error('Erro: ' + response.status);
                return response.json();
            })
            .then(function(data) {
                console.log('Status do pagamento:', data.status);

                if (data.isPaid) {
                    console.log('PAGAMENTO APROVADO!');
                    clearInterval(pollingInterval);
                    window.location.href = './obrigado.html?transactionId=' + data.transactionId + '&amount=' + data.amount;
                }
            })
            .catch(function(error) {
                console.error('Erro no polling:', error);
            });
        }, 3000);

        // Timeout after 10 minutes
        setTimeout(function() {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                console.log('Polling timeout - 10 minutos');
            }
        }, 600000);
    }

});
